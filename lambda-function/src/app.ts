import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Event } from "aws-lambda";
import { streamToString } from "./streamToString";
import { Readable } from "stream";
import { s3Client } from "./s3Client.js";
import MatMeasure from "./models/MatMeasure";
import { convertToMadieMeasure } from "./utils/measureConversionUtils";
import { Measure } from "@madie/madie-models";
import { MeasureServiceApi } from "./api/MeasureServiceApi";
import MailService from "./utils/mailservice";

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
  let emailMessage: string = "";
  const logAndMail = (message: string) => {
    console.log(message);
    emailMessage = `${emailMessage}${message}\n`;
  };

  console.log("Lambda handler started.....");
  const bucket: string = event.Records[0].s3.bucket.name;
  const key: string = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
  console.log(`Source bucket:${bucket}, file name: ${key}`);

  const params = {
    Bucket: bucket,
    Key: key,
  };
  let madieMeasure: Measure = {} as Measure;
  let emailId: string = "gregory.akins@icf.com";
  const mailService: MailService = new MailService();
  try {
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const bodyContents = await streamToString(Body as Readable);
    const matMeasure: MatMeasure = JSON.parse(bodyContents);
    logAndMail("--------MAT Measure Details-------");
    logAndMail(`User: ${matMeasure.harpId}`);
    logAndMail(`Measure id: ${matMeasure?.manageMeasureDetailModel.id}`);
    logAndMail(`Measure name: ${matMeasure?.manageMeasureDetailModel.measureName}`);
    logAndMail(`Measure version: ${matMeasure?.manageMeasureDetailModel.versionNumber}`);
    logAndMail(`Measure revisionNumber: ${matMeasure?.manageMeasureDetailModel.revisionNumber}`);
    logAndMail(`Measure cqlLibraryName: ${matMeasure?.manageMeasureDetailModel.cqllibraryName}`);
    logAndMail(`CMS ID: ${matMeasure?.manageMeasureDetailModel.eMeasureId}`);
    logAndMail("Converting measure from MAT to MADiE format");
    madieMeasure = convertToMadieMeasure(matMeasure);
    logAndMail("Transferring measure over to MADiE");
    const response = await new MeasureServiceApi(MADiE_SERVICE_URL, MADiE_API_KEY).transferMeasureToMadie(
      madieMeasure,
      matMeasure.harpId,
    );
    logAndMail(`Transferred Measure id: ${response.id}`);
    console.log("Lambda execution completed...");
    const result = await mailService.sendMail(emailId, "Successfully imported the Measure", emailMessage);
    return response;
  } catch (error: any) {
    console.log("Lambda Transfer Failed....sending email");
    logAndMail(error.message);
    console.log(`Mailing the error message ${emailMessage}`);
    const result = await mailService.sendMail(emailId, "Failed to import the measure", emailMessage);
    console.error(`Lambda Transfer Failed because ${error.message}`);

    return madieMeasure;
  }
};
