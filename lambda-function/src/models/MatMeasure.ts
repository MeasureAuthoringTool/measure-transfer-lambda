export interface Author {
  id: string;
  authorName: string;
  orgId: string;
}

export interface MeasureSteward {
  id: string;
  orgName: string;
  orgOid: string;
}
export interface MeasureType {
  id: string;
  description: string;
  abbrName: string;
}

export interface PeriodModel {
  uuid: string;
  startDate: string;
  stopDate: string;
  calenderYear: boolean;
}

export interface NQFModel {
  root: string;
  extension: string;
}

export interface MeasureDetailResult {
  usedSteward?: MeasureSteward;
  usedAuthorList?: Array<Author>;
  allAuthorList?: Array<Author>;
  allStewardList?: Array<MeasureSteward>;
}

export interface MeasureDetails {
  id: string;
  measureName: string;
  measureModel: string;
  shortName: string;
  versionNumber: string;
  revisionNumber?: string;
  measureId: string;
  groupName?: string;
  groupId?: string;
  finalizedDate?: string;
  measFromPeriod?: string;
  measToPeriod?: string;
  measScoring?: string;
  stewardValue?: string;
  endorseByNQF?: boolean;
  nqfId?: string;
  description?: string;
  copyright?: string;
  clinicalRecomms?: string;
  definitions?: string;
  guidance?: string;
  transmissionFormat?: string;
  rationale?: string;
  improvNotations?: string;
  stratification?: string;
  referencesList?: Array<string>;
  authorSelectedList?: Array<Author>;
  stewardSelectedList?: Array<MeasureSteward>;
  measureTypeSelectedList?: Array<MeasureType>;
  qdsSelectedList?: string;
  componentMeasuresSelectedList?: string;
  toCompareAuthor?: string;
  toCompareMeasure?: string;
  toCompareComponentMeasures?: string;
  draft?: boolean;
  measureSetId?: string;
  valueSetDate?: string;
  supplementalData?: string;
  disclaimer?: string;
  riskAdjustment?: string;
  rateAggregation?: string;
  initialPop?: string;
  denominator?: string;
  denominatorExclusions?: string;
  numerator?: string;
  numeratorExclusions?: string;
  denominatorExceptions?: string;
  measurePopulation?: string;
  measureObservations?: string;
  eMeasureId?: number;
  orgVersionNumber?: string;
  qltyMeasureSetUuid?: string;
  stewardId?: string;
  scoringAbbr?: string;
  periodModel?: PeriodModel;
  endorsement?: string;
  endorsementId?: string;
  nqfModel?: NQFModel;
  measureOwnerId?: string;
  measurePopulationExclusions?: string;
  measureDetailResult?: MeasureDetailResult;
  qdmVersion?: string;
  fhirVersion?: string;
  formattedVersion?: string;
  experimental?: boolean;
  populationBasis?: boolean;
  editable?: boolean;
  calenderYear?: boolean;
  deleted?: boolean;
  patientBased?: boolean;
  cqllibraryName?: string;
  fhir?: boolean;
}

export default interface MatMeasure {
  emailId: string;
  harpId: string;
  manageMeasureDetailModel: MeasureDetails;
  fhirMeasureResourceJson: string;
  fhirLibraryResourcesJson: string;
}
