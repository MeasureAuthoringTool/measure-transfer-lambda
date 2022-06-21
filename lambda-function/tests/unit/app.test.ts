import { S3Event } from "aws-lambda";
import { Readable } from "stream";
import { lambdaHandler } from "../../src/app";
import { s3Client } from "../../src/s3Client";
import matMeasure from "./fixtures/measure.json";
import putEvent from "./fixtures/s3PutEvent.json";
import axios from "axios";
import { Measure, Model } from "@madie/madie-models";
import { convertToMadieMeasure } from "../../src/utils/measureConversionUtils";

jest.mock("axios");

jest.mock("@aws-sdk/client-s3");

describe("Unit test for lambda handler", () => {
  let event: S3Event;
  let readableDataStream: Readable;

  beforeEach(() => {
    jest.resetAllMocks();
    event = putEvent as S3Event;
    readableDataStream = new Readable();
    readableDataStream.push(JSON.stringify(matMeasure));
    readableDataStream.push(null);
  });

  it("reads s3 object and transfer it over to MADiE successfully", async () => {
    const measureToTransfer = convertToMadieMeasure(matMeasure);
    axios.post.mockResolvedValue({ data: measureToTransfer });

    s3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream });

    const madieMeasure: Measure = await lambdaHandler(event);
    expect(madieMeasure.measureName).toEqual(matMeasure.manageMeasureDetailModel.measureName);
    expect(madieMeasure.cqlLibraryName).toEqual(matMeasure.manageMeasureDetailModel.cqllibraryName);
    expect(madieMeasure.measureScoring).toEqual(matMeasure.manageMeasureDetailModel.measScoring);
    expect(madieMeasure.model).toEqual(Model.QICORE);
    expect(madieMeasure.createdBy).toEqual(matMeasure.harpId);
    expect(madieMeasure).toHaveProperty("cql");
  });

  it("handles validation errors from MADiE service", async () => {
    s3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream });
    axios.post.mockImplementation(() => {
      throw new Error("Duplicate library error");
    });

    try {
      await lambdaHandler(event);
    } catch (exception) {
      expect(exception.message).toEqual("Duplicate library error");
    }
  });

  it("handles s3 exception if any", async () => {
    s3Client.send.mockImplementation(() => {
      throw new Error("Connection error");
    });

    try {
      await lambdaHandler(event);
    } catch (exception) {
      expect(exception.message).toEqual("Connection error");
    }
  });
});
