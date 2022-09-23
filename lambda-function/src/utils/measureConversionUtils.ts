import {
  Group,
  Measure,
  MeasureMetadata,
  Model,
  MeasureGroupTypes,
  Population,
  PopulationType,
} from "@madie/madie-models";
import MatMeasure, { MeasureDetails, MeasureType } from "../models/MatMeasure";
import { getPopulationsForScoring } from "./populationHelper";

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
  shortName: "ecqmTitle",
  formattedVersion: "cmsId",
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
        const [month, day, year] = value.split("/");
        const date = new Date(year, month - 1, day, 1, 0, 0);
        value = date.toISOString();
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
  const developers = measureDetails.measureDetailResult?.usedAuthorList?.map((author) => {
    return author.authorName;
  });
  const references = measureDetails.referencesList?.map((reference: any) => {
    return reference;
  });
  const endorsement = {
    endorser: measureDetails.endorseByNQF ? "NQF" : "",
    endorsementId: measureDetails.nqfId,
  };
  return {
    steward: measureDetails.stewardValue,
    description: measureDetails.description,
    copyright: measureDetails.copyright,
    disclaimer: measureDetails.disclaimer,
    draft: true,
    developers: developers,
    rationale: measureDetails.rationale,
    guidance: measureDetails.guidance,
    clinicalRecommendation: measureDetails.clinicalRecomms,
    references: references,
    endorsements: [endorsement],
    riskAdjustment: measureDetails.riskAdjustment,
    definition: measureDetails.definitions,
    experimental: measureDetails.experimental,
    transmissionFormat: measureDetails.transmissionFormat,
    supplementalDataElements: measureDetails.supplementalData,
    // TODO: keep adding new metadata fields as we support them in MADiE
  };
};

type MadiePopulationType = {
  [key: string]: string;
};

// convert populations
const convertPopulation = (matPopulation: any) => {
  const populationCoding = matPopulation.code.coding.find((coding: any) => coding.system === POPULATION_CODING_SYSTEM);
  const code: string = POPULATION_CODE_MAPPINGS[populationCoding.code];
  return {
    id: matPopulation.id,
    name: getPopulationType(code),
    definition: matPopulation.criteria.expression,
  } as Population;
};

// convert MAT measure groups to MADiE measure groups
export const convertMeasureGroups = (measureResourceJson: string, measureDetails: MeasureDetails): Array<Group> => {
  if (!measureResourceJson) {
    return [];
  }

  const measureResource = JSON.parse(measureResourceJson);

  return measureResource.group.map((group: any) => {
    // default group scoring is measure scoring
    const madieMeasureGroup = {
      scoring: measureResource.scoring.coding[0].display,
      populationBasis: measureDetails.populationBasis,
      rateAggregation: measureDetails.rateAggregation,
      improvementNotation: measureDetails.improvNotations,
    } as Group;

    const populations = Object.entries(group.population).map((item) => {
      return convertPopulation(item[1]);
    });
    const allPopulations = getPopulationsForScoring(madieMeasureGroup.scoring as string);
    const unselectedAndSelectedPopulations: Population[] = getAllPopulations(allPopulations, populations);
    madieMeasureGroup.populations = unselectedAndSelectedPopulations;

    if (measureDetails.measureTypeSelectedList) {
      madieMeasureGroup.measureGroupTypes = getMeasuretypes(measureDetails.measureTypeSelectedList);
    }
    return madieMeasureGroup;
  });
};

export const getPopulationType = (type: string): PopulationType => {
  switch (type) {
    case "initialPopulation":
      return PopulationType.INITIAL_POPULATION;
    case "numerator":
      return PopulationType.NUMERATOR;
    case "numeratorExclusion":
      return PopulationType.NUMERATOR_EXCLUSION;
    case "denominator":
      return PopulationType.DENOMINATOR;
    case "denominatorExclusion":
      return PopulationType.DENOMINATOR_EXCLUSION;
    case "denominatorException":
      return PopulationType.DENOMINATOR_EXCEPTION;
    case "measurePopulation":
      return PopulationType.MEASURE_POPULATION;
    case "measurePopulationExclusion":
      return PopulationType.MEASURE_POPULATION_EXCLUSION;
    case "measureObservation":
      return PopulationType.MEASURE_OBSERVATION;
    default:
      return PopulationType.INITIAL_POPULATION;
  }
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
  // convert metadata properties
  const measureMetaData = convertMeasureMetadata(measureDetails);
  // convert groups
  const measureGroups = convertMeasureGroups(matMeasure.fhirMeasureResourceJson, measureDetails);

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
  } as Measure;

  return madieMeasure;
};

const getAllPopulations = (allPopulations: Population[], selectedPopulations: Population[]): Population[] => {
  const unselectedAndSelectedPopulations: Population[] = [];
  allPopulations.forEach((population) => {
    const tempPopulation = getSelected(population, selectedPopulations);
    if (Object.keys(tempPopulation).length === 0) {
      unselectedAndSelectedPopulations.push(population);
    } else {
      unselectedAndSelectedPopulations.push(tempPopulation);
    }
  });
  return unselectedAndSelectedPopulations;
};

const getSelected = (population: Population, selectedPopulations: Population[]): Population => {
  let selected: Population = {} as Population;
  selectedPopulations.forEach((pop) => {
    if (pop.name === population.name) {
      selected = pop;
    }
  });
  return selected;
};
