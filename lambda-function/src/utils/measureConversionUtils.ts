import Measure, { Group, MeasureMetadata } from "../models/Measure";
import MatMeasure, { MeasureDetails } from "../models/MatMeasure";
import { Model } from "../models/Model";

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
    populationMap[code] = population.criteria.expression;
    return populationMap;
  }, {} as MadiePopulationType);

  return populations;
};

// convert MAT measure groups to MADiE measure groups
const convertMeasureGroups = (measureResourceJson: string): Array<Group> => {
  if (!measureResourceJson) {
    return [];
  }

  const measureResource = JSON.parse(measureResourceJson);

  return measureResource.group.map((group: any) => {
    // default group scoring is measure scoring
    const madieMeasureGroup = {
      scoring: measureResource.scoring.coding[0].display,
    } as Group;

    const populations = convertPopulations(group.population);
    madieMeasureGroup.population = populations;

    return madieMeasureGroup;
  });
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

  return {
    cqlLibraryName: mainLibrary.resource.name,
    cql: textCql,
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
  // convert metadata properties
  const measureMetaData = convertMeasureMetadata(measureDetails);
  // convert groups
  const measureGroups = convertMeasureGroups(matMeasure.fhirMeasureResourceJson);

  // get measure library name and cql
  const { cqlLibraryName, cql } = getMeasureLibraryNameAndCql(matMeasure);

  const madieMeasure = {
    ...measureProperties,
    measureMetaData: measureMetaData,
    groups: measureGroups,
    cql: cql,
    cqlLibraryName: cqlLibraryName,
    createdBy: matMeasure.harpId,
    lastModifiedBy: matMeasure.harpId,
  } as Measure;

  return madieMeasure;
};
