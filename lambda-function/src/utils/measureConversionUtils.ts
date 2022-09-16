import { Group, Measure, MeasureMetadata, Model, MeasureGroupTypes, Population } from "@madie/madie-models";
import MatMeasure, { MeasureDetails, MeasureType } from "../models/MatMeasure";

const POPULATION_CODING_SYSTEM = "http://terminology.hl7.org/CodeSystem/measure-population";
const MEASURE_PROPERTY_MAPPINGS = {
  measureSetId: "measureSetId",
  versionNumber: "version",
  revisionNumber: "revisionNumber",
  draft: "state",
  measureName: "measureName",
  cqlLibraryName: "cqlLibraryName",
  measScoring: "measureScoring",
  fhir: "model",
  measFromPeriod: "measurementPeriodStart",
  measToPeriod: "measurementPeriodEnd",
  populationBasis: "populationBasis",
  id: "versionId",
};

const POPULATION_CODE_MAPPINGS: { [key: string]: string } = {
  "initial-population": "initialPopulation",
  numerator: "numerator",
  "numerator-exclusion": "numeratorExclusion",
  denominator: "denominator",
  "denominator-exclusion": "denominatorExclusion",
  "denominator-exception": "denominatorException",
  "measure-population": "measurePopulation",
  "measure-population-exclusion": "measurePopulationExclusion",
  "measure-observation": "measureObservation",
};

// transform measure level properties
const convertMeasureProperties = (measureDetails: MeasureDetails) => {
  return Object.entries(MEASURE_PROPERTY_MAPPINGS)
    .map(([matProperty, madieProperty]) => {
      // @ts-ignore
      let value = measureDetails[matProperty];
      // all fhir measures imported as QI-Core
      if (matProperty === "fhir" && value) {
        value = Model.QICORE;
      }
      if ((matProperty === "measFromPeriod" || matProperty === "measToPeriod") && value) {
        const date = new Date(value);
        value = date.toISOString().split("T")[0];
      }
      return [madieProperty, value];
    })
    .reduce(
      (currentProperty, [nextKey, nextValue]) => ({
        ...currentProperty,
        [nextKey]: nextValue,
      }),
      {},
    );
};

// convert measure metadata level properties
const convertMeasureMetadata = (measureDetails: MeasureDetails): MeasureMetadata => {
  return {
    steward: measureDetails.stewardValue,
    description: measureDetails.description,
    copyright: measureDetails.copyright,
    disclaimer: measureDetails.disclaimer,
    // TODO: keep adding new metadata fields as we support them in MADiE
  };
};

type MadiePopulationType = {
  [key: string]: string;
};

// convert populations
const convertPopulations = (matPopulations: any) => {
  const populations = matPopulations.reduce((populationMap: MadiePopulationType, population: any) => {
    const populationCoding = population.code.coding.find((coding: any) => coding.system === POPULATION_CODING_SYSTEM);
    const code: string = POPULATION_CODE_MAPPINGS[populationCoding.code];

    populationMap["id"] = population.id;
    populationMap["name"] = code;
    populationMap["definition"] = population.criteria.expression;

    return populationMap;
  }, {} as MadiePopulationType);

  return populations;
};

// convert MAT measure groups to MADiE measure groups
export const convertMeasureGroups = (
  measureResourceJson: string,
  measuretypes: any,
  populationBasis: string,
): Array<Group> => {
  if (!measureResourceJson) {
    return [];
  }

  const measureResource = JSON.parse(measureResourceJson);

  return measureResource.group.map((group: any) => {
    // default group scoring is measure scoring
    const madieMeasureGroup = {
      scoring: measureResource.scoring.coding[0].display,
    } as Group;

    //const population = convertPopulations(group.population);
    const populations: Population[] = [];
    let result = Object.entries(group.population);
    result.map((item) => {
      const value = item[1];
      const matPopulations = [];
      matPopulations.push(value);
      const population = convertPopulations(matPopulations);
      populations.push(population);
    });
    madieMeasureGroup.populations = populations;

    madieMeasureGroup.measureGroupTypes = getMeasuretypes(measuretypes);
    madieMeasureGroup.populationBasis = populationBasis;
    return madieMeasureGroup;
  });
};

const getMeasuretypes = (measuretypes: Array<MeasureType>): Array<MeasureGroupTypes> => {
  const types: Array<MeasureGroupTypes> = [];
  measuretypes.map((type) => {
    switch (type.description) {
      case MeasureGroupTypes.OUTCOME:
        types.push(MeasureGroupTypes.OUTCOME);
        break;
      case MeasureGroupTypes.PATIENT_REPORTED_OUTCOME:
        types.push(MeasureGroupTypes.PATIENT_REPORTED_OUTCOME);
        break;
      case MeasureGroupTypes.PROCESS:
        types.push(MeasureGroupTypes.PROCESS);
        break;
      case MeasureGroupTypes.STRUCTURE:
        types.push(MeasureGroupTypes.STRUCTURE);
        break;
      default:
        types.push(MeasureGroupTypes.OUTCOME);
        break;
    }
  });
  return types;
};

// Get measure library name and cql
const getMeasureLibraryNameAndCql = (matMeasure: MatMeasure): { cqlLibraryName: string; cql: string } => {
  const measureResource = JSON.parse(matMeasure.fhirMeasureResourceJson);
  const measureLibraries = JSON.parse(matMeasure.fhirLibraryResourcesJson);

  // find main library of a measure
  const mainLibrary = measureLibraries.entry.find((library: any) => {
    return library.resource.url.includes(measureResource.library[0]);
  });

  const libraryContents = mainLibrary.resource.content;
  // get base64 CQL string
  const cqlContent = libraryContents.find((content: any) => content.contentType === "text/cql");
  const cqlBuffer = Buffer.from(cqlContent.data, "base64");
  // convert base64 string to text cql
  const textCql = cqlBuffer.toString("ascii");
  const qiCoreCql = textCql.replace(/^using FHIR.*/gm, "using QICore version '4.1.0'");

  return {
    cqlLibraryName: mainLibrary.resource.name,
    cql: qiCoreCql,
  };
};

// convert MAT measure to MADiE measure
export const convertToMadieMeasure = (matMeasure: MatMeasure): Measure => {
  if (!matMeasure) {
    throw new Error("Empty Measure");
  }
  const measureDetails: MeasureDetails = matMeasure.manageMeasureDetailModel;

  // convert measure properties
  const measureProperties = convertMeasureProperties(measureDetails);
  const populationBasis = getMeasurePropertyValue("populationBasis", measureProperties);
  const measureResource = JSON.parse(matMeasure.fhirMeasureResourceJson);
  // convert metadata properties
  const measureMetaData = convertMeasureMetadata(measureDetails);
  // convert groups
  const measureGroups = convertMeasureGroups(
    matMeasure.fhirMeasureResourceJson,
    measureDetails.measureTypeSelectedList,
    populationBasis,
  );

  // get measure library name and cql
  const { cqlLibraryName, cql } = getMeasureLibraryNameAndCql(matMeasure);

  const madieMeasure = {
    ...measureProperties,
    active: true,
    measureMetaData: measureMetaData,
    groups: measureGroups,
    cql: cql,
    cqlLibraryName: cqlLibraryName,
    createdBy: matMeasure.harpId,
    lastModifiedBy: matMeasure.harpId,
    ecqmTitle: getMeasurePropertyValue("title", measureResource),
    cmsId: getCmsId(measureResource, "identifier"),
  } as Measure;

  return madieMeasure;
};

const getMeasurePropertyValue = (propertyName: string, measureProperties: Object): string => {
  let propertyValue = "";
  if (measureProperties) {
    Object.entries(measureProperties).map(([key, value]) => {
      if (key === propertyName) {
        propertyValue = value.toString();
      }
    });
  }
  return propertyValue;
};

const getCmsId = (measureResource: Object, property: string) => {
  const cmsIdObj = getMatMeasureValue(measureResource, property);
  let cmsId = "";
  if (cmsIdObj !== null) {
    Object.entries(cmsIdObj).map((item) => {
      const identifier = item[1] as Object;
      const objStr = JSON.stringify(item[1]);
      if (identifier !== null && objStr.includes("ecqm") && objStr.includes("Identifier")) {
        cmsId = getMeasurePropertyValue("value", identifier);
      }
    });
  }
  return cmsId;
};

const getMatMeasureValue = (measureResource: Object, property: string) => {
  let matMeasureValue = null;
  Object.entries(measureResource).map((item) => {
    if (item[0] === property) {
      matMeasureValue = item[1];
    }
  });
  return matMeasureValue;
};
