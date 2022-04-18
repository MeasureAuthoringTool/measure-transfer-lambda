import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Event } from "aws-lambda";
import { streamToString } from "./streamToString";
import { Readable } from "stream";
import { s3Client } from "./s3Client.js";
import MatMeasure from "./models/MatMeasure";
import { convertToMadieMeasure } from "./utils/measureConversionUtils";
import { Measure } from "@madie/madie-models";
import { MeasureServiceApi } from "./api/MeasureServiceApi";

import { MADiE_SERVICE_URL, MADiE_API_KEY } from "./configs/configs";

/**
 * Lambda function handler
 * Event doc: https://docs.aws.amazon.com/AmazonS3/latest/userguide/notification-content-structure.html
 * @param {S3Event} event - S3
 *
 * @returns {Promise} object - string representation of measure json
 *
 */
export const lambdaHandler = async (event: S3Event): Promise<Measure> => {
  console.log("Lambda handler started.....");
  const bucket: string = event.Records[0].s3.bucket.name;
  const key: string = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  console.log(`Source bucket:${bucket}, file name: ${key}`);

  const params = {
    Bucket: bucket,
    Key: key,
  };

  try {
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const bodyContents = await streamToString(Body as Readable);
    console.log("Contents:", bodyContents);

    const matMeasure: MatMeasure = JSON.parse(bodyContents);
    const madieMeasure: Measure = convertToMadieMeasure(matMeasure);
    const response = await new MeasureServiceApi(MADiE_SERVICE_URL, MADiE_API_KEY).transferMeasureToMadie(
      madieMeasure,
      matMeasure.harpId,
    );
    console.log("Transferred Measure id: ", response.id);
    console.log("Lambda execution completed...");
    return response;
  } catch (error: any) {
    // TODO: error email notification
    console.log("Error: ", error);
    throw new Error(error.message);
  }
};
