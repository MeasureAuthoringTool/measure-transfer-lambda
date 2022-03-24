export enum MeasureScoring {
  COHORT = "Cohort",
  CONTINUOUS_VARIABLE = "Continuous Variable",
  PROPORTION = "Proportion",
  RATIO = "Ratio",
}

export type MeasureScoringKeys = keyof typeof MeasureScoring;
