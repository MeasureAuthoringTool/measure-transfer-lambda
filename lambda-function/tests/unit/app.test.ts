import { S3Event } from "aws-lambda";
import { Readable } from "stream";
import { lambdaHandler } from "../../src/app";
import { s3Client } from "../../src/s3Client";
import matMeasure from "./fixtures/measure.json";
import matProportionMeasure from "./fixtures/measure_proportion.json";
import matCVMeasure from "./fixtures/measure_continuousVariable.json";
import matRatioMeasure from "./fixtures/measure_ratio.json";
import matDefaultMeasure from "./fixtures/measure_default.json";
import putEvent from "./fixtures/s3PutEvent.json";
import axios from "axios";
import { Measure, Model, PopulationType } from "@madie/madie-models";
import { convertToMadieMeasure, convertMeasureGroups, getPopulationType } from "../../src/utils/measureConversionUtils";

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
    expect(madieMeasure.cql).toContain("using QICore version '4.1.0'");
  });

  it("test proportion measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matProportionMeasure);
    expect(measureToTransfer.groups?.length).toBe(1);
    expect(measureToTransfer.groups[0].populations?.length).toBe(6);
  });

  it("test continuous variable measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matCVMeasure);
    expect(measureToTransfer.groups?.length).toBe(1);
    expect(measureToTransfer.groups[0].populations?.length).toBe(3);
  });

  it("test ratio measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matRatioMeasure);
    expect(measureToTransfer.groups?.length).toBe(1);
    expect(measureToTransfer.groups[0].populations?.length).toBe(5);
  });

  it("test default measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matDefaultMeasure);
    expect(measureToTransfer.groups?.length).toBe(2);
    expect(measureToTransfer.groups[0].populations?.length).toBe(2);
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

  it("throws convert error", () => {
    try {
      convertToMadieMeasure("");
    } catch (error) {
      expect(error.message).toBe("Empty Measure");
    }
  });

  it("empty groups", () => {
    const madieMeasureGroup = convertMeasureGroups("", null, "");
    expect(madieMeasureGroup.length).toBe(0);
  });

  it("test getPopulationType", () => {
    let result: PopulationType = getPopulationType("numerator");
    expect(result).toBe(PopulationType.NUMERATOR);
    result = getPopulationType("numeratorExclusion");
    expect(result).toBe(PopulationType.NUMERATOR_EXCLUSION);
    result = getPopulationType("denominator");
    expect(result).toBe(PopulationType.DENOMINATOR);
    result = getPopulationType("denominatorExclusion");
    expect(result).toBe(PopulationType.DENOMINATOR_EXCLUSION);
    result = getPopulationType("denominatorException");
    expect(result).toBe(PopulationType.DENOMINATOR_EXCEPTION);
    result = getPopulationType("measurePopulation");
    expect(result).toBe(PopulationType.MEASURE_POPULATION);
    result = getPopulationType("measurePopulationExclusion");
    expect(result).toBe(PopulationType.MEASURE_POPULATION_EXCLUSION);
    result = getPopulationType("measureObservation");
    expect(result).toBe(PopulationType.MEASURE_OBSERVATION);
    result = getPopulationType("test");
    expect(result).toBe(PopulationType.INITIAL_POPULATION);
  });
});
