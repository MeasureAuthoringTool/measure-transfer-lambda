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
import { parseError } from "./utils/resultutils";

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
  let emailMessage = "";
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
  let emailId = "";
  let matMeasure = {} as MatMeasure;
  let cmsId;
  const mailService: MailService = new MailService();

  try {
    const { Body } = await s3Client.send(new GetObjectCommand(params));
    const bodyContents = await streamToString(Body as Readable);
    matMeasure = JSON.parse(bodyContents);
    madieMeasure = convertToMadieMeasure(matMeasure);
    cmsId = matMeasure.manageMeasureDetailModel?.eMeasureId;
    emailId = matMeasure.emailId;

    const response = await new MeasureServiceApi(MADiE_SERVICE_URL, MADiE_API_KEY).transferMeasureToMadie(
      madieMeasure,
      matMeasure.harpId,
      cmsId,
    );
    // response should be measure according to tests.
    if (response) {
      /* Success email */
      logAndMail("--------Measure Details-------");
      logAndMail(`User: ${matMeasure.harpId}`);
      logAndMail(`Measure name: ${matMeasure?.manageMeasureDetailModel.measureName}`);
      logAndMail("Measure version in MADiE: 0.0.000");
      logAndMail(`Measure cqlLibraryName: ${matMeasure?.manageMeasureDetailModel.cqllibraryName}`);
      if (cmsId) {
        logAndMail(`CMS ID: ${cmsId}`);
      }
      emailMessage = `${emailMessage}\nSincerely,\nThe MADiE Support Team`;
      /* Success email end */
      console.log(`Measure id in MADiE: ${response.id}`);
      console.log(`Measure id in MAT: ${matMeasure?.manageMeasureDetailModel.id}`);
      console.log("Lambda execution completed...", response);
    }
    await mailService.sendMail(emailId, "Successfully transferred your measure from MAT to MADiE", emailMessage);
    return response;
  } catch (error: any) {
    console.log("Lambda Transfer Failed....sending email");
    /* Failure email  */
    // header
    logAndMail("\nTransferring your measure resulted in the following error message:\n");
    logAndMail(`\t${parseError(error?.message)}`);
    // body
    logAndMail("\n--------Measure Details-------");
    logAndMail(`User: ${matMeasure?.harpId}`);
    logAndMail(`Measure id in MAT: ${matMeasure?.manageMeasureDetailModel?.id}`);
    logAndMail(`Measure name: ${matMeasure?.manageMeasureDetailModel?.measureName}`);
    logAndMail(`Measure version in MAT: ${matMeasure?.manageMeasureDetailModel?.versionNumber}`);
    logAndMail(`Measure cqlLibraryName: ${matMeasure?.manageMeasureDetailModel?.cqllibraryName}`);
    if (cmsId) {
      logAndMail(`CMS ID: ${cmsId}`);
    }
    console.log(`Mailing the error message ${emailMessage}`);
    /* Failure email end  */

    if (emailId.length > 0) {
      await mailService.sendMail(emailId, "Failed to transfer your measure from MAT to MADiE", emailMessage);
    }
    console.error(`Lambda Transfer Failed because ${error.message}`);
    return madieMeasure;
  }
};
