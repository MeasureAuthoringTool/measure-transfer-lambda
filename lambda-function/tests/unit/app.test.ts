import { S3Event } from "aws-lambda";
import { Readable } from "stream";
import { lambdaHandler } from "../../src/app";
import { s3Client } from "../../src/s3Client";
import matMeasure from "./fixtures/measure.json";
import matProportionMeasure from "./fixtures/measure_proportion.json";
import matCVMeasure from "./fixtures/measure_continuousVariable.json";
import matRatioMeasure from "./fixtures/measure_ratio.json";
import matDefaultMeasure from "./fixtures/measure_default.json";
import matMeasureNoCmsId from "./fixtures/measure_noCmsId.json";
import putEvent from "./fixtures/s3PutEvent.json";
import matQdmCvMeasure from "./fixtures/measure_qdm.json";
import matQdmDefaults from "./fixtures/measure_qdm_defaults.json";
import matQdmCvMeasureDefaultBaseConfigurationType from "./fixtures/measure_qdm_defaultBaseConfigurationType.json";
import matQdmProportionMeasure from "./fixtures/measure_qdm_proportion.json";
import matQdmProportionMeasure2 from "./fixtures/measure_qdm_proportion_2.json";
import ucumUnitsMeasure from "./fixtures/measure_ucum_units.json";
import matQdmRatioMeasure from "./fixtures/measure_qdm_ratio.json";
import axios from "axios";
import MatMeasure from "../../src/models/MatMeasure";
import { Measure, Model, PopulationType } from "@madie/madie-models";

import {
  convertToMadieMeasure,
  convertMeasureGroups,
  getPopulationType,
  getPopulationDescription,
  getMeasureTypes,
} from "../../src/utils/measureConversionUtils";
import { MeasureDetails } from "../../src/models/MatMeasure";

import MailService from "../../src/utils/mailservice";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;
jest.mock("@aws-sdk/client-s3");
const mockS3Client = s3Client as jest.Mocked<typeof s3Client>;

jest.mock("../../src/utils/mailservice");
const mailServiceMock = MailService as jest.Mock<MailService>;
const mailServiceMockResolved = {
  sendMail: jest.fn().mockResolvedValue(() => {
    return null;
  }),
} as unknown as MailService;

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
    const measureToTransfer = convertToMadieMeasure(matMeasure as unknown as MatMeasure);
    mockedAxios.post.mockResolvedValue({ data: measureToTransfer });

    mockS3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream } as never);

    const madieMeasure: Measure = await lambdaHandler(event);
    expect(madieMeasure.measureName).toEqual(matMeasure.manageMeasureDetailModel.measureName);
    expect(madieMeasure.version).toEqual("0.0.1");
    expect(madieMeasure.cqlLibraryName).toEqual(matMeasure.manageMeasureDetailModel.cqllibraryName);
    expect(madieMeasure.scoring).toBeUndefined();
    expect(madieMeasure.model).toEqual(Model.QICORE);
    expect(madieMeasure.createdBy).toEqual(matMeasure.harpId);
    expect(madieMeasure).toHaveProperty("cql");
    expect(madieMeasure.cql).toContain("using QICore version '4.1.1'");
    expect(madieMeasure?.groups?.[0]?.scoring).toEqual("Cohort");
    expect(madieMeasure.measureMetaData?.steward).toMatchObject({ name: "SemanticBits" });
    expect(madieMeasure.measureMetaData?.developers).toMatchObject([{ name: "Able Health" }, { name: "SemanticBits" }]);
    expect(madieMeasure.supplementalDataDescription).toEqual(matMeasure.manageMeasureDetailModel.supplementalData);
    expect(madieMeasure.riskAdjustmentDescription).toEqual(matMeasure.manageMeasureDetailModel.riskAdjustment);

    expect(madieMeasure.measureMetaData?.endorsements?.length).toBe(1);
    expect(madieMeasure.measureMetaData?.endorsements?.at(0)?.endorser).toEqual("CMS Consensus Based Entity");
    expect(madieMeasure.measureMetaData?.endorsements?.at(0)?.endorsementId).toEqual(
      matMeasure.manageMeasureDetailModel.nqfId,
    );
    expect(madieMeasure.measureMetaData?.endorsements?.at(0)?.endorserSystemId).toEqual("https://www.qualityforum.org");

    expect(mockS3Client.send).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it("test proportion measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matProportionMeasure as unknown as MatMeasure);
    expect(measureToTransfer.groups?.length).toBe(1);
    expect(measureToTransfer.groups?.[0]?.populations?.length).toBe(6);
    // make sure optional population id is not empty
    expect(measureToTransfer?.groups?.[0]?.populations?.[2]?.name).toBe("denominatorExclusion");
    expect(measureToTransfer?.groups?.[0]?.populations?.[2]?.id).not.toBe("");
  });

  it("test continuous variable measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matCVMeasure as unknown as MatMeasure);
    expect(measureToTransfer.groups?.length).toBe(0);
  });

  it("test ratio measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matRatioMeasure as unknown as MatMeasure);
    expect(measureToTransfer.groups?.length).toBe(1);
    expect(measureToTransfer.groups?.[0]?.populations?.length).toBe(5);
  });

  it("test find default CMS Id on measure", () => {
    const measureToTransfer = convertToMadieMeasure(matMeasureNoCmsId as unknown as MatMeasure);
    expect(measureToTransfer.cmsId).toEqual("1175FHIR");
  });

  it("test find QDM defaults on QDMmeasure", () => {
    const measureToTransfer = convertToMadieMeasure(matQdmDefaults as unknown as MatMeasure);
    expect(measureToTransfer.groups?.[0].scoring).toBeUndefined();
  });

  it("test find FHIR defaults on FHIR measure", () => {
    const measureToTransfer = convertToMadieMeasure(matDefaultMeasure as unknown as MatMeasure);
    expect(measureToTransfer.scoring).toBeUndefined();
  });

  it("test default measure group and populations", () => {
    const measureToTransfer = convertToMadieMeasure(matDefaultMeasure as unknown as MatMeasure);
    expect(measureToTransfer.groups?.length).toBe(2);
    expect(measureToTransfer.groups?.[0]?.populations?.length).toBe(0);
  });

  it("test QDM ratio measure conversion", () => {
    const measureToTransfer = convertToMadieMeasure(matQdmRatioMeasure as unknown as MatMeasure);
    expect(measureToTransfer).toBeTruthy();
    expect(measureToTransfer.measureName).toEqual("Qdm4");
    expect(measureToTransfer.cqlLibraryName).toEqual("CMS1179");
    expect(measureToTransfer.scoring).toEqual("Ratio");
    expect(measureToTransfer.patientBasis).toEqual(true);
    expect(measureToTransfer.model).toEqual("QDM v5.6");
    expect(measureToTransfer.groups).toBeTruthy();
    expect(measureToTransfer.groups?.length).toEqual(2);
    expect(measureToTransfer.supplementalData).toBeTruthy();
    expect(measureToTransfer.supplementalData?.length).toEqual(4);
    expect(measureToTransfer.riskAdjustments).toBeTruthy();
    expect(measureToTransfer.riskAdjustments?.length).toEqual(2);

    expect(measureToTransfer.groups?.[0]?.scoring).toEqual("Ratio");
    expect(measureToTransfer.groups?.[0]?.populations?.length).toEqual(6); // two ips!
    expect(measureToTransfer.groups?.[0]?.populations?.[0]?.definition).toEqual("ipp");
    expect(measureToTransfer.groups?.[0]?.populations?.[0]?.description).toEqual("initial pop description 1");
    expect(measureToTransfer.groups?.[0]?.populations?.[0]?.associationType).toEqual("Denominator");

    expect(measureToTransfer.groups?.[0]?.populations?.[1]?.definition).toEqual("ipp2");
    expect(measureToTransfer.groups?.[0]?.populations?.[1]?.associationType).toEqual("Numerator");
    expect(measureToTransfer.groups?.[0]?.populations?.[2]?.description).toEqual("denominator description");
    expect(measureToTransfer.groups?.[0]?.populations?.[4]?.description).toEqual("numerator description");
    expect(measureToTransfer.groups?.[0]?.populations?.[5]?.description).toEqual("denominator description");
    expect(measureToTransfer.groups?.[0]?.measureObservations?.length).toEqual(2);
    const g1Obs1CriteriaRef = measureToTransfer?.groups?.[0]?.measureObservations?.[0]?.criteriaReference;
    expect(g1Obs1CriteriaRef).toBeTruthy();
    // referenced population should exist!
    const g1Obs1RefPop = measureToTransfer?.groups?.[0]?.populations?.find((pop) => pop.id === g1Obs1CriteriaRef);
    expect(g1Obs1RefPop).toBeTruthy();
    const g1Obs2CriteriaRef = measureToTransfer?.groups?.[0]?.measureObservations?.[1]?.criteriaReference;
    expect(g1Obs2CriteriaRef).toBeTruthy();
    // referenced population should exist!
    const g1Obs2RefPop = measureToTransfer?.groups?.[0]?.populations?.find((pop) => pop.id === g1Obs2CriteriaRef);
    expect(g1Obs2RefPop).toBeTruthy();
  });

  it("test QDM CV measure conversion", () => {
    const measureToTransfer = convertToMadieMeasure(matQdmCvMeasure as unknown as MatMeasure);
    expect(measureToTransfer).toBeTruthy();
    expect(measureToTransfer.measureName).toEqual("ObsTestTransfer");
    expect(measureToTransfer.cqlLibraryName).toEqual("CMS1175");
    expect(measureToTransfer.scoring).toEqual("Continuous Variable");
    expect(measureToTransfer.patientBasis).toEqual(false);
    expect(measureToTransfer.model).toEqual("QDM v5.6");
    expect(measureToTransfer.groups).toBeTruthy();
    expect(measureToTransfer.groups?.length).toEqual(3);
    expect(measureToTransfer.supplementalData).toBeTruthy();
    expect(measureToTransfer.supplementalData?.length).toEqual(4);
    expect(measureToTransfer.riskAdjustments).toBeFalsy();
    const year = new Date().getFullYear();
    expect(measureToTransfer.measurementPeriodStart).toEqual(`${year}-01-01T00:00:00.000Z`);
    expect(measureToTransfer.measurementPeriodEnd).toEqual(`${year}-12-31T23:59:59.999Z`);
    expect(measureToTransfer.groups?.[0]?.scoring).toEqual("Continuous Variable");
    expect(measureToTransfer.groups?.[0]?.populations?.length).toEqual(3);
    expect(measureToTransfer.groups?.[0]?.measureObservations?.length).toEqual(1);
    expect(measureToTransfer?.baseConfigurationTypes.length).toEqual(9);
    expect(measureToTransfer?.baseConfigurationTypes?.[0]).toEqual("Process");
    const g1Obs1CriteriaRef = measureToTransfer?.groups?.[0]?.measureObservations?.[0]?.criteriaReference;
    expect(g1Obs1CriteriaRef).toBeTruthy();
    // referenced population should exist!
    const g1Obs1RefPop = measureToTransfer?.groups?.[0]?.populations?.find((pop) => pop.id === g1Obs1CriteriaRef);
    expect(g1Obs1RefPop).toBeTruthy();
  });

  it("test QDM CV measure conversion with default BaseConfigurationType", () => {
    const measureToTransfer = convertToMadieMeasure(
      matQdmCvMeasureDefaultBaseConfigurationType as unknown as MatMeasure,
    );
    expect(measureToTransfer).toBeTruthy();
    expect(measureToTransfer.measureName).toEqual("ObsTestTransfer");
    expect(measureToTransfer.cqlLibraryName).toEqual("CMS1175");
    expect(measureToTransfer.scoring).toEqual("Continuous Variable");
    expect(measureToTransfer.patientBasis).toEqual(false);
    expect(measureToTransfer.model).toEqual("QDM v5.6");
    expect(measureToTransfer.groups).toBeTruthy();
    expect(measureToTransfer.groups?.length).toEqual(3);
    expect(measureToTransfer.supplementalData).toBeTruthy();
    expect(measureToTransfer.supplementalData?.length).toEqual(4);
    expect(measureToTransfer.riskAdjustments).toBeFalsy();
    const year = new Date().getFullYear();
    expect(measureToTransfer.measurementPeriodStart).toEqual(`${year}-01-01T00:00:00.000Z`);
    expect(measureToTransfer.measurementPeriodEnd).toEqual(`${year}-12-31T23:59:59.999Z`);

    expect(measureToTransfer.groups?.[0]?.scoring).toEqual("Continuous Variable");
    expect(measureToTransfer.groups?.[0]?.populations?.length).toEqual(3);
    expect(measureToTransfer.groups?.[0]?.measureObservations?.length).toEqual(1);
    expect(measureToTransfer?.baseConfigurationTypes.length).toEqual(1);
    expect(measureToTransfer?.baseConfigurationTypes?.[0]).toEqual("Outcome");
    const g1Obs1CriteriaRef = measureToTransfer?.groups?.[0]?.measureObservations?.[0]?.criteriaReference;
    expect(g1Obs1CriteriaRef).toBeTruthy();
    // referenced population should exist!
    const g1Obs1RefPop = measureToTransfer?.groups?.[0]?.populations?.find((pop) => pop.id === g1Obs1CriteriaRef);
    expect(g1Obs1RefPop).toBeTruthy();
  });

  it("test QDM Proportion measure conversion", () => {
    const measureToTransfer = convertToMadieMeasure(matQdmProportionMeasure as unknown as MatMeasure);
    expect(measureToTransfer).toBeTruthy();
    expect(measureToTransfer.measureName).toEqual("Qdm3");
    expect(measureToTransfer.cqlLibraryName).toEqual("CMS1177");
    expect(measureToTransfer.scoring).toEqual("Proportion");
    expect(measureToTransfer.patientBasis).toEqual(true);
    expect(measureToTransfer.model).toEqual("QDM v5.6");
    expect(measureToTransfer.groups).toBeTruthy();
    expect(measureToTransfer.groups?.length).toEqual(2);
    expect(measureToTransfer.supplementalData).toBeTruthy();
    expect(measureToTransfer.supplementalData?.length).toEqual(4);
    expect(measureToTransfer.riskAdjustments).toBeFalsy();

    expect(measureToTransfer.groups?.[0]?.scoring).toEqual("Proportion");
    expect(measureToTransfer.groups?.[0]?.populations?.length).toEqual(6);
    expect(measureToTransfer.groups?.[0]?.measureObservations).toBeFalsy();
    expect(measureToTransfer.groups?.[0]?.stratifications).toBeTruthy();
    expect(measureToTransfer.groups?.[0]?.stratifications?.length).toEqual(2);
    // expect(measureToTransfer.groups[0].stratifications[0]).toEqual(1);
  });

  it("test QDM Proportion measure conversion with descriptions", () => {
    const measureToTransfer = convertToMadieMeasure(matQdmProportionMeasure2 as unknown as MatMeasure);
    expect(measureToTransfer).toBeTruthy();
    expect(measureToTransfer.measureName).toEqual("QdmProportionMeasure124567789895567");
    expect(measureToTransfer.cqlLibraryName).toEqual("QdmProportionMeasure345789876789");
    expect(measureToTransfer.scoring).toEqual("Proportion");
    expect(measureToTransfer.patientBasis).toEqual(true);
    expect(measureToTransfer.model).toEqual("QDM v5.6");
    expect(measureToTransfer.groups).toBeTruthy();
    expect(measureToTransfer.groups?.length).toEqual(2);
    expect(measureToTransfer.supplementalData).toBeTruthy();
    expect(measureToTransfer.supplementalData?.length).toEqual(4);
    expect(measureToTransfer.riskAdjustments).toBeFalsy();

    expect(measureToTransfer.groups?.[0]?.scoring).toEqual("Proportion");

    expect(measureToTransfer.groups?.[0]?.populations?.length).toEqual(6);
    expect(measureToTransfer.groups?.[0]?.populations?.[0]?.definition).toEqual("Initial Population");
    expect(measureToTransfer.groups?.[0]?.populations?.[0]?.description).toEqual(
      "This is an Initial population text description",
    );

    expect(measureToTransfer.groups?.[0]?.populations?.[1]?.definition).toEqual("Denominator");
    expect(measureToTransfer.groups?.[0]?.populations?.[1]?.description).toEqual(
      "This is Denominator text description",
    );
    expect(measureToTransfer.groups?.[0]?.populations?.[2]?.definition).toEqual("Denominator");
    expect(measureToTransfer.groups?.[0]?.populations?.[2]?.description).toEqual(
      "Denominator exclusion text description",
    );
    expect(measureToTransfer.groups?.[0]?.populations?.[3]?.definition).toEqual("Numerator");
    expect(measureToTransfer.groups?.[0]?.populations?.[4]?.definition).toEqual("Numerator");
    expect(measureToTransfer.groups?.[0]?.measureObservations).toBeFalsy();
  });

  it("handles validation errors from MADiE service", async () => {
    mockS3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream } as never);

    mockedAxios.post.mockRejectedValueOnce({
      status: 400,
      response: { data: "Duplicate library error" },
    });

    try {
      await lambdaHandler(event);
    } catch (error: any) {
      if (error instanceof Error) {
        expect(error.message).toEqual('"Duplicate library error"');
      }
    }
  });

  it("handles JSON formatted errors from MADiE service", async () => {
    mockS3Client.send.mockResolvedValue({ ContentType: "binary/octet-stream", Body: readableDataStream } as never);

    mockedAxios.post.mockRejectedValueOnce({
      status: 400,
      response: {
        data: {
          timestamp: "2024-01-22T19:55:30.492+00:00",
          status: 400,
          error: "Bad Request",
          message: "CQL library with given name already exists.",
          validationErrors: { cqlLibraryName: "CQL library with given name already exists." },
        },
      },
    });

    try {
      const measure = await lambdaHandler(event);
      expect(measure).toBeDefined();
    } catch (error: any) {
      if (error instanceof Error) {
        fail("Shouldn't have reached this");
      }
    }
  });

  it("handles s3 exception if any", async () => {
    mockS3Client.send.mockImplementation(() => {
      throw new Error("Connection error");
    });

    try {
      await lambdaHandler(event);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toEqual("Connection error");
      }
    }
  });

  it("throws convert error", () => {
    try {
      convertToMadieMeasure("" as unknown as MatMeasure);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe("Empty Measure");
      }
    }
  });

  it("throws convert error and calls email service", () => {
    mailServiceMock.mockImplementation(() => {
      return mailServiceMockResolved;
    });
    try {
      convertToMadieMeasure("" as unknown as MatMeasure);
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe("Empty Measure");
        const mailService: MailService = new MailService();
        mailService.sendMail("name@example.com", "test", "error message");
        expect(MailService).toHaveBeenCalledTimes(1);
      }
    }
  });

  it("empty groups", () => {
    const madieMeasureGroup = convertMeasureGroups("", null as unknown as MeasureDetails);
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

  it("test getPopulationDescription", () => {
    const measureDetails: MeasureDetails = {
      id: "testMeasureId",
      measureId: "",
      measureName: "testMeasureName",
      measureModel: "FHIR",
      shortName: "testMeasureShortName",
      versionNumber: "0.000",
      initialPop: "test Initial Population",
      denominator: "test denominator",
      denominatorExclusions: "test denominatorExclusions",
      denominatorExceptions: "test denominatorExceptions",
      numerator: "test numerator",
      numeratorExclusions: "test numeratorExclusions",
      measurePopulation: "test measurePopulation",
      measurePopulationExclusions: "test measurePopulationExclusions",
      measureObservations: "test measureObservations",
    };
    let result = getPopulationDescription("initialPopulation", measureDetails);
    expect(result).toBe("test Initial Population");
    result = getPopulationDescription("denominator", measureDetails);
    expect(result).toBe("test denominator");
    result = getPopulationDescription("denominatorExclusion", measureDetails);
    expect(result).toBe("test denominatorExclusions");
    result = getPopulationDescription("denominatorException", measureDetails);
    expect(result).toBe("test denominatorExceptions");
    result = getPopulationDescription("numerator", measureDetails);
    expect(result).toBe("test numerator");
    result = getPopulationDescription("numeratorExclusion", measureDetails);
    expect(result).toBe("test numeratorExclusions");
    result = getPopulationDescription("measurePopulation", measureDetails);
    expect(result).toBe("test measurePopulation");
    result = getPopulationDescription("measurePopulationExclusion", measureDetails);
    expect(result).toBe("test measurePopulationExclusions");
    result = getPopulationDescription("measureObservation", measureDetails);
    expect(result).toBe("test measureObservations");
    result = getPopulationDescription("default", measureDetails);
    expect(result).toBe("test Initial Population");
  });

  it("test getMeasureTypes", () => {
    const matMeasureTypes = [
      { id: "1", description: "Appropriate Use Process", abbrName: "ABC" },
      { id: "2", description: "Cost/Resource Use", abbrName: "PQR" },
      { id: "3", description: "Efficiency", abbrName: "XYZ" },
      { id: "4", description: "Intermediate Clinical Outcome", abbrName: "XYZ" },
      { id: "5", description: "Outcome", abbrName: "STU" },
      { id: "6", description: "Patient Engagement/Experience", abbrName: "JKL" },
      { id: "7", description: "Process", abbrName: "ICF" },
      { id: "8", description: "Structure", abbrName: "NYP" },
      { id: "9", description: "Unknown", abbrName: "HYP" },
    ];
    const madieMeasureTypes = getMeasureTypes(matMeasureTypes);
    expect(madieMeasureTypes.length).toEqual(4);
    expect(madieMeasureTypes[0]).toBe("Process");
    expect(madieMeasureTypes[1]).toBe("Structure");
    expect(madieMeasureTypes[2]).toBe("Outcome");
    expect(madieMeasureTypes[3]).toBe("Patient Reported Outcome");
  });

  it("should transfer ucum units and Reporting content", () => {
    const expectedScoringUnitForCriteria1 = {
      label: "g/kg  gram per kilogram",
      value: {
        code: "g/kg ",
        guidance: null,
        name: "gram per kilogram",
        system: "https://clinicaltables.nlm.nih.gov/",
      },
    };
    const expectedScoringUnitForCriteria2 = {
      label: "ng/(24.h) nanogram per 24 hour",
      value: {
        code: "ng/(24.h)",
        guidance: null,
        name: "nanogram per 24 hour",
        system: "https://clinicaltables.nlm.nih.gov/",
      },
    };
    const madieMeasure = convertToMadieMeasure(ucumUnitsMeasure as unknown as MatMeasure);
    expect(madieMeasure?.groups?.length).toBe(3);
    expect(madieMeasure.groups?.[0]?.scoringUnit).toStrictEqual(expectedScoringUnitForCriteria1);
    expect(madieMeasure.groups?.[1]?.scoringUnit).toStrictEqual(expectedScoringUnitForCriteria2);

    expect(madieMeasure.rateAggregation).toBe("This is Example of RA");
    expect(madieMeasure.improvementNotation).toBe("Increased score indicates improvement");
  });
});
