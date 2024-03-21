import {
  BaseConfigurationTypes,
  Group,
  Measure,
  MeasureGroupTypes,
  MeasureMetadata,
  MeasureObservation,
  MeasureScoring,
  Model,
  Population,
  PopulationType,
  SupplementalData,
} from "@madie/madie-models";
import MatMeasure, { MeasureDetails, MeasureType } from "../models/MatMeasure";
import { getPopulationsForScoring } from "./populationHelper";
import { randomUUID } from "crypto";
import { MatMeasureType } from "../models/MatMeasureTypes";
import { XMLParser } from "fast-xml-parser";
import * as _ from "lodash";
import { Stratification } from "@madie/madie-models/dist/Measure";
import * as ucum from "@lhncbc/ucum-lhc";

const POPULATION_CODING_SYSTEM = "http://terminology.hl7.org/CodeSystem/measure-population";
const MEASURE_PROPERTY_MAPPINGS = {
  measureSetId: "measureSetId",
  draft: "state",
  measureName: "measureName",
  cqlLibraryName: "cqlLibraryName",
  measScoring: "scoring",
  fhir: "model",
  measFromPeriod: "measurementPeriodStart",
  measToPeriod: "measurementPeriodEnd",
  populationBasis: "populationBasis",
  patientBased: "patientBasis",
  shortName: "ecqmTitle",
  supplementalData: "supplementalDataDescription",
  riskAdjustment: "riskAdjustmentDescription",
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
      // all fhir measures imported as QI-Core, else QDM 5.6
      if (matProperty === "fhir") {
        value = value ? Model.QICORE : Model.QDM_5_6;
      }
      if ((matProperty === "measFromPeriod" || matProperty === "measToPeriod") && value) {
        value = new Date(value).toISOString().split("T")[0].concat("T").concat(new Date().toISOString().split("T")[1]);
      } else if (matProperty === "measFromPeriod") {
        // default measurement period start to start of year
        const start = new Date();
        start.setUTCFullYear(start.getFullYear(), 0, 1);
        start.setUTCHours(0, 0, 0, 0);
        value = start.toISOString();
      } else if (matProperty === "measToPeriod") {
        // default measurement period end to end of year
        const end = new Date();
        end.setUTCFullYear(end.getFullYear(), 11, 31);
        end.setUTCHours(23, 59, 59, 999);
        value = end.toISOString();
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
export const convertMeasureMetadata = (measureDetails: MeasureDetails): MeasureMetadata => {
  const developers = measureDetails.measureDetailResult?.usedAuthorList?.map((author) => {
    return {
      name: author.authorName,
    };
  });
  const references = measureDetails.referencesList?.map((reference: any) => {
    reference.id = randomUUID().toString();
    return reference;
  });
  return {
    steward: { name: measureDetails.stewardValue },
    description: measureDetails.description,
    copyright: measureDetails.copyright,
    disclaimer: measureDetails.disclaimer,
    draft: true,
    developers: developers,
    rationale: measureDetails.rationale,
    guidance: measureDetails.guidance,
    clinicalRecommendation: measureDetails.clinicalRecomms,
    references: references,
    endorsements: buildEndorsements(measureDetails),
    definition: measureDetails.definitions,
    experimental: measureDetails.experimental,
    transmissionFormat: measureDetails.transmissionFormat,
    // TODO: keep adding new metadata fields as we support them in MADiE
  };
};

// Assumption: If endorseByNQF is true then nqfId will not be empty
// MAT-6566 Endorsement will be defaulted to CBE for both Qi-Core and QDM measures
const buildEndorsements = (measureDetails: MeasureDetails) => {
  const endorsements = [];
  if (measureDetails.endorseByNQF) {
    endorsements.push({
      endorser: "CMS Consensus Based Entity",
      endorsementId: measureDetails.nqfId,
      endorserSystemId: "https://www.qualityforum.org",
    });
  }
  return endorsements;
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
    case "numeratorExclusions":
      return measureDetails.numeratorExclusions;
    case "denominator":
      return measureDetails.denominator;
    case "denominatorExclusion":
    case "denominatorExclusions":
      return measureDetails.denominatorExclusions;
    case "denominatorException":
    case "denominatorExceptions":
      return measureDetails.denominatorExceptions;
    case "measurePopulation":
      return measureDetails.measurePopulation;
    case "measurePopulationExclusion":
    case "measurePopulationExclusions":
      return measureDetails.measurePopulationExclusions;
    case "measureObservation":
      return measureDetails.measureObservations;
    default:
      return measureDetails.initialPop;
  }
};

export const isPopulation = (type: string): boolean => {
  return type !== "stratum" && type !== "measureObservation";
};

const determineAssociationType = (population: any, populationsInGrouping: any[]): string | undefined => {
  let associationType = undefined;
  const popType = populationsInGrouping.find(
    (popInGroup) => popInGroup["@_associatedPopulationUUID"] === population["@_uuid"],
  )?.["@_type"];
  if ("NUMERATOR" === popType?.toUpperCase()) {
    associationType = "Numerator";
  } else if ("DENOMINATOR" === popType?.toUpperCase()) {
    associationType = "Denominator";
  }
  return associationType;
};

export const convertQdmMeasureGroups = (simpleXml: string, measureDetails: MeasureDetails) => {
  const parser = new XMLParser({ ignoreAttributes: false });
  const simpleMeasure = parser.parse(simpleXml);
  const groups = valueAsArray(simpleMeasure?.measure?.measureGrouping?.group);

  const scoring: string = measureDetails.measScoring ?? MeasureScoring.COHORT;
  const allPopulations = getPopulationsForScoring(scoring);

  const resultGroups = groups?.map((group: any) => {
    const ucumUnits = group["@_ucum"];
    const clauses = valueAsArray(group?.clause) ?? [];

    const scoringUnit = ucumCodeToOption(ucumUnits);
    const observations = clauses
      ?.filter((population: any) => population["@_type"] === "measureObservation")
      ?.map((population: any) => {
        const criteriaReference =
          scoring === MeasureScoring.RATIO
            ? population["@_associatedPopulationUUID"]
            : clauses?.find(
                (searchPop: any) =>
                  searchPop["@_isInGrouping"] === "true" && searchPop["@_type"] === "measurePopulation",
              )?.["@_uuid"];

        return {
          id: population["@_uuid"],
          aggregateMethod: population.cqlaggfunction["@_displayName"],
          definition: population.cqlaggfunction.cqlfunction["@_displayName"],
          description: measureDetails.measureObservations,
          criteriaReference: criteriaReference,
        } as MeasureObservation;
      });

    const popsInGrouping = clauses?.filter(
      (population: any) => isPopulation(population["@_type"]) && population["@_isInGrouping"] === "true",
    );
    const hasTwoIps =
      popsInGrouping?.filter((population: any) => population["@_type"] === "initialPopulation")?.length === 2;

    const populations =
      popsInGrouping?.map((population: any) => {
        const popType = population["@_type"];
        const associationType =
          hasTwoIps && population["@_type"] === "initialPopulation" && scoring === MeasureScoring.RATIO
            ? determineAssociationType(population, popsInGrouping)
            : undefined;
        return {
          id: population["@_uuid"],
          name: getPopulationType(popType),
          definition: population.cqldefinition["@_displayName"],
          description: getPopulationDescription(popType, measureDetails),
          associationType,
        } as Population;
      }) ?? [];

    const pops = getAllPopulations(allPopulations, populations);

    // seems like a grouping in MAT can only have a single stratification, but that has multiple stratums
    // which does not align directly with stratification representation in MADiE...
    // convert MAT stratum to MADiE stratifications
    const stratifications = [
      ...clauses
        ?.filter((population: any) => population["@_type"] === "stratum" && population["@_isInGrouping"] !== "false")
        ?.map((population: any) => {
          const stratDefine = population.cqldefinition["@_displayName"];
          const stratRefPop = clauses.find((refPop: any) => refPop?.cqldefinition?.["@_displayName"] === stratDefine);

          return {
            id: population["@_uuid"],
            cqlDefinition: stratDefine,
            // attempt to match association based on define
            // association is required in MADiE..so default to IP per getPopulationType
            association: getPopulationType(stratRefPop?.["@_type"]),
          } as Stratification;
        }),
    ];
    const result: Group = {
      id: undefined as unknown as string,
      scoring: measureDetails.measScoring,
      // populations: getAllPopulations(allPopulations, populations),
      populations: pops,
      measureObservations: _.isNil(observations) || _.isEmpty(observations) ? null : observations,
      groupDescription: undefined,
      scoringUnit: !_.isEmpty(scoringUnit) ? scoringUnit : undefined,
      stratifications: _.isNil(stratifications) || _.isEmpty(stratifications) ? undefined : stratifications,
      populationBasis: `${measureDetails.patientBased}`,
    } as Group;
    return result;
  });
  return resultGroups;
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

export const ucumCodeToOption = (matUcumCode: string) => {
  // somehow this loads ucum codes into memory and is required
  ucum.UcumLhcUtils.getInstance();
  let allUnitCodes = ucum.UnitTables.getInstance().unitCodes_;
  allUnitCodes = _.mapKeys(allUnitCodes, (value, key) => _.trim(key));
  const ucumUnit = allUnitCodes[matUcumCode];
  if (!_.isNil(ucumUnit)) {
    return {
      label: `${ucumUnit.csCode_} ${ucumUnit.name_}`,
      value: {
        code: ucumUnit.csCode_,
        guidance: ucumUnit.guidance_,
        name: ucumUnit.name_,
        system: "https://clinicaltables.nlm.nih.gov/",
      },
    };
  }
  return undefined;
};

export const getPopulationType = (type: string): PopulationType => {
  switch (type) {
    case "initialPopulation":
      return PopulationType.INITIAL_POPULATION;
    case "numerator":
      return PopulationType.NUMERATOR;
    case "numeratorExclusion":
    case "numeratorExclusions":
      return PopulationType.NUMERATOR_EXCLUSION;
    case "denominator":
      return PopulationType.DENOMINATOR;
    case "denominatorExclusion":
    case "denominatorExclusions":
      return PopulationType.DENOMINATOR_EXCLUSION;
    case "denominatorException":
    case "denominatorExceptions":
      return PopulationType.DENOMINATOR_EXCEPTION;
    case "measurePopulation":
      return PopulationType.MEASURE_POPULATION;
    case "measurePopulationExclusion":
    case "measurePopulationExclusions":
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

export const getBaseConfigurationTypes = (
  measuretypes: Array<MeasureType> | undefined,
): Array<BaseConfigurationTypes> => {
  const types = new Set<BaseConfigurationTypes>();
  measuretypes?.map((type) => {
    switch (type.description) {
      case MatMeasureType.PROCESS:
        types.add(BaseConfigurationTypes.PROCESS);
        break;
      case MatMeasureType.APPROPRIATE_USE_PROCESS:
        types.add(BaseConfigurationTypes.APPROPRIATE_USE_PROCESS);
        break;
      case MatMeasureType.STRUCTURE:
        types.add(BaseConfigurationTypes.STRUCTURE);
        break;
      case MatMeasureType.COST_RESOURCE_USE:
        types.add(BaseConfigurationTypes.COST_OR_RESOURCE_USE);
        break;
      case MatMeasureType.EFFICIENCY:
        types.add(BaseConfigurationTypes.EFFICIENCY);
        break;
      case MatMeasureType.OUTCOME:
        types.add(BaseConfigurationTypes.OUTCOME);
        break;
      case MatMeasureType.INTERMEDIATE_CLINICAL_OUTCOME:
        types.add(BaseConfigurationTypes.INTERMEDIATE_CLINICAL_OUTCOME);
        break;
      case MatMeasureType.PATIENT_ENGAGEMENT_EXPERIENCE:
        types.add(BaseConfigurationTypes.PATIENT_ENGAGEMENT_OR_EXPERIENCE);
        break;
      case MatMeasureType.PATIENT_REPORTED_OUTCOME_PERFORMANCE:
        types.add(BaseConfigurationTypes.PATIENT_REPORTED_OUTCOME_PERFORMANCE);
        break;
      default:
        types.add(BaseConfigurationTypes.OUTCOME);
        break;
    }
  });
  return Array.from(types.values());
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
  const qiCoreCql = textCql.replace(/^using FHIR.*/gm, "using QICore version '4.1.1'");

  return {
    cqlLibraryName: mainLibrary.resource.name,
    cql: qiCoreCql,
  };
};

const getQdmMeasureLibraryNameAndCql = (matMeasure: MatMeasure): { cqlLibraryName: string; cql: string } => {
  return {
    cqlLibraryName: matMeasure.manageMeasureDetailModel.cqllibraryName ?? "",
    cql: matMeasure.cql,
  };
};

/**
 * Takes a value that may be undefined, a single object, or an array, and returns undefined or an array
 * If the input is undefined/null, undefined will be returned.
 * If the input is a single object, then an array will be returned with that input object as the single child.
 * Otherwise, the input array will be returned.
 * @param value
 */
const valueAsArray = (value: any): any[] | undefined => {
  let arr = undefined;
  if (!_.isNil(value)) {
    arr = _.isArray(value) ? value : [{ ...value }];
  }
  return arr;
};

const getSupplementalData = (matMeasure: MatMeasure): SupplementalData[] | undefined => {
  let supplementalData = undefined;
  if (matMeasure.manageMeasureDetailModel.measureModel === "QDM") {
    const parser = new XMLParser({ ignoreAttributes: false });
    const simpleMeasure = parser.parse(matMeasure.simpleXml);
    supplementalData = valueAsArray(simpleMeasure.measure?.supplementalDataElements?.cqldefinition)?.map(
      (sde: any) =>
        ({
          definition: sde["@_displayName"],
        } as SupplementalData),
    );
  }
  // currently, continuing to skip this for FHIR

  return supplementalData;
};

const getRiskAdjustments = (matMeasure: MatMeasure) => {
  let riskAdjustments = undefined;
  if (matMeasure.manageMeasureDetailModel.measureModel === "QDM") {
    const parser = new XMLParser({ ignoreAttributes: false });
    const simpleMeasure = parser.parse(matMeasure.simpleXml);
    riskAdjustments = valueAsArray(simpleMeasure.measure?.riskAdjustmentVariables?.cqldefinition)?.map(
      (rav: any) =>
        ({
          definition: rav["@_displayName"],
        } as SupplementalData),
    );
  }
  // currently, continuing to skip this for FHIR

  return riskAdjustments;
};

// convert MAT measure to MADiE measure
export const convertToMadieMeasure = (matMeasure: MatMeasure): Measure => {
  if (!matMeasure) {
    throw new Error("Empty Measure");
  }
  const measureDetails: MeasureDetails = matMeasure.manageMeasureDetailModel;

  // convert measure properties
  const measureProperties: any = convertMeasureProperties(measureDetails);
  // convert metadata properties
  const measureMetaData = convertMeasureMetadata(measureDetails);

  const isQDM = matMeasure.manageMeasureDetailModel?.measureModel === "QDM";
  // convert groups
  const measureGroups = isQDM
    ? convertQdmMeasureGroups(matMeasure.simpleXml, measureDetails)
    : convertMeasureGroups(matMeasure.fhirMeasureResourceJson, measureDetails);

  // get measure library name and cql
  const { cqlLibraryName, cql } = isQDM
    ? getQdmMeasureLibraryNameAndCql(matMeasure)
    : getMeasureLibraryNameAndCql(matMeasure);

  return {
    ...measureProperties,
    versionId: randomUUID(),
    active: true,
    measureMetaData: measureMetaData,
    groups: measureGroups,
    cql: cql,
    scoring: isQDM ? measureProperties.scoring : undefined,
    version: buildVersion(measureDetails),
    cqlLibraryName: cqlLibraryName,
    createdBy: matMeasure.harpId,
    lastModifiedBy: matMeasure.harpId,
    supplementalData: getSupplementalData(matMeasure),
    riskAdjustments: getRiskAdjustments(matMeasure),
    rateAggregation: isQDM ? matMeasure.manageMeasureDetailModel.rateAggregation : undefined,
    improvementNotation: isQDM ? matMeasure.manageMeasureDetailModel.improvNotations : undefined,
    supplementalDataDescription: measureDetails.supplementalData,
    riskAdjustmentDescription: measureDetails.riskAdjustment,
    baseConfigurationTypes: isQDM ? getBaseConfigurationTypes(measureDetails.measureTypeSelectedList) : undefined,
  } as Measure;
};

const buildVersion = (measureDetails: MeasureDetails) => {
  const versionBrick = measureDetails.versionNumber.split(".");
  return `${versionBrick[0]}.${parseInt(versionBrick[1])}.${measureDetails.revisionNumber}`;
};

const getAllPopulations = (allPopulations: Population[], selectedPopulations: Population[]): Population[] => {
  const unselectedAndSelectedPopulations: Population[] = [];
  const workingPopulations = [...selectedPopulations];
  allPopulations.forEach((population) => {
    let tempPopulation = getSelected(population, workingPopulations);
    // handle multiple of any population type
    do {
      if (_.isNil(tempPopulation)) {
        unselectedAndSelectedPopulations.push({ ...population, id: randomUUID() });
      } else {
        workingPopulations.splice(workingPopulations.indexOf(tempPopulation), 1);
        unselectedAndSelectedPopulations.push(tempPopulation);
      }
    } while (!_.isNil((tempPopulation = getSelected(population, workingPopulations))));
  });
  return unselectedAndSelectedPopulations;
};

const getSelected = (population: Population, selectedPopulations: Population[]): Population | undefined => {
  return selectedPopulations.find((pop) => pop.name === population.name);
};
