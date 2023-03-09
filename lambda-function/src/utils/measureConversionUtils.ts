import {
  Group,
  Measure,
  MeasureMetadata,
  Model,
  MeasureGroupTypes,
  Population,
  PopulationType,
  MeasureScoring,
  Endorsement,
} from "@madie/madie-models";
import MatMeasure, { MeasureDetails, MeasureType } from "../models/MatMeasure";
import { getPopulationsForScoring } from "./populationHelper";
import { randomUUID } from "crypto";
import { MatMeasureType } from "../models/MatMeasureTypes";

const POPULATION_CODING_SYSTEM = "http://terminology.hl7.org/CodeSystem/measure-population";
const MEASURE_PROPERTY_MAPPINGS = {
  measureSetId: "measureSetId",
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

const CMS_IDENTIFIERR_SYSTEM = "http://hl7.org/fhir/cqi/ecqm/Measure/Identifier/cms";

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
        value = new Date(value).toISOString().split("T")[0].concat("T").concat(new Date().toISOString().split("T")[1]);
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
    endorserSystemId: measureDetails.endorseByNQF ? "https://www.qualityforum.org" : ""
  } as Endorsement;
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

// convert populations
const convertPopulation = (matPopulation: any, measureDetails: MeasureDetails) => {
  const populationCoding = matPopulation.code.coding.find((coding: any) => coding.system === POPULATION_CODING_SYSTEM);
  const code: string = POPULATION_CODE_MAPPINGS[populationCoding.code];
  return {
    id: matPopulation.id,
    name: getPopulationType(code),
    definition: matPopulation.criteria.expression,
    description: getPopulationDescription(code, measureDetails),
  } as Population;
};

export const getPopulationDescription = (type: string, measureDetails: MeasureDetails): any => {
  switch (type) {
    case "initialPopulation":
      return measureDetails.initialPop;
    case "numerator":
      return measureDetails.numerator;
    case "numeratorExclusion":
      return measureDetails.numeratorExclusions;
    case "denominator":
      return measureDetails.denominator;
    case "denominatorExclusion":
      return measureDetails.denominatorExclusions;
    case "denominatorException":
      return measureDetails.denominatorExceptions;
    case "measurePopulation":
      return measureDetails.measurePopulation;
    case "measurePopulationExclusion":
      return measureDetails.measurePopulationExclusions;
    case "measureObservation":
      return measureDetails.measureObservations;
    default:
      return measureDetails.initialPop;
  }
};

// convert MAT measure groups to MADiE measure groups
export const convertMeasureGroups = (measureResourceJson: string, measureDetails: MeasureDetails): Array<Group> => {
  if (!measureResourceJson || measureDetails.measScoring === MeasureScoring.CONTINUOUS_VARIABLE) {
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
      return convertPopulation(item[1], measureDetails);
    });
    const allPopulations = getPopulationsForScoring(madieMeasureGroup.scoring as string);
    madieMeasureGroup.populations = getAllPopulations(allPopulations, populations);

    if (measureDetails.measureTypeSelectedList) {
      madieMeasureGroup.measureGroupTypes = getMeasureTypes(measureDetails.measureTypeSelectedList);
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

export const getMeasureTypes = (measuretypes: Array<MeasureType>): Array<MeasureGroupTypes> => {
  const types: Array<MeasureGroupTypes> = [];
  measuretypes.map((type) => {
    switch (type.description) {
      case MatMeasureType.PROCESS:
      case MatMeasureType.APPROPRIATE_USE_PROCESS:
        addMeasureType(types, MeasureGroupTypes.PROCESS);
        break;
      case MatMeasureType.STRUCTURE:
      case MatMeasureType.COST_RESOURCE_USE:
      case MatMeasureType.EFFICIENCY:
        addMeasureType(types, MeasureGroupTypes.STRUCTURE);
        break;
      case MatMeasureType.OUTCOME:
      case MatMeasureType.INTERMEDIATE_CLINICAL_OUTCOME:
        addMeasureType(types, MeasureGroupTypes.OUTCOME);
        break;
      case MatMeasureType.PATIENT_ENGAGEMENT_EXPERIENCE:
      case MatMeasureType.PATIENT_REPORTED_OUTCOME_PERFORMANCE:
        addMeasureType(types, MeasureGroupTypes.PATIENT_REPORTED_OUTCOME);
        break;
      default:
        addMeasureType(types, MeasureGroupTypes.OUTCOME);
        break;
    }
  });
  return types;
};

const addMeasureType = (measureTypes: Array<MeasureGroupTypes>, measureType: MeasureGroupTypes) => {
  if (!measureTypes.includes(measureType)) {
    measureTypes.push(measureType);
  }
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
    version:buildVersion(measureDetails),
    cqlLibraryName: cqlLibraryName,
    createdBy: matMeasure.harpId,
    lastModifiedBy: matMeasure.harpId,
    cmsId: getCmsId(matMeasure.fhirMeasureResourceJson, measureDetails),
  } as Measure;

  return madieMeasure;
};

const buildVersion = (measureDetails: MeasureDetails)=>{
  const versionBrick = measureDetails.versionNumber.split(".");
  return `${versionBrick[0]}.${parseInt(versionBrick[1])}.${measureDetails.revisionNumber}`
  
}

const getAllPopulations = (allPopulations: Population[], selectedPopulations: Population[]): Population[] => {
  const unselectedAndSelectedPopulations: Population[] = [];
  allPopulations.forEach((population) => {
    const tempPopulation = getSelected(population, selectedPopulations);
    if (Object.keys(tempPopulation).length === 0) {
      unselectedAndSelectedPopulations.push({ ...population, id: randomUUID() });
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

const getCmsId = (measureResourceJson: string, measureDetails: MeasureDetails): string => {
  const measureResource = JSON.parse(measureResourceJson);
  const identifiers = measureResource.identifier;
  let cmsIdentifier = identifiers?.find((identifier: any) => identifier.system === CMS_IDENTIFIERR_SYSTEM)?.value;
  if (!cmsIdentifier && measureDetails.eMeasureId !== 0) {
    cmsIdentifier = measureDetails.eMeasureId + "FHIR";
  }
  return cmsIdentifier;
};
