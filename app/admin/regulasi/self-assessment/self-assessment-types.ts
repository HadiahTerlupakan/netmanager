/** Bentuk respons API Self-Assessment di sisi klien. */

export type SampleOutcome = "MET" | "NOT_MET" | "PENDING";

export interface PeriodStatistic {
  received: number;
  met: number;
  ratio: number | null;
}

export interface ServiceLevelSample {
  reference: string;
  startedAt: string;
  finishedAt: string | null;
  durationDays: number;
  outcome: SampleOutcome;
  siteName: string | null;
  region: string;
}

export interface ParameterSummary {
  key: string;
  number: number;
  title: string;
  basis: string;
  standardLabel: string;
  targetRatio: number;
  maxDays: number;
  dayUnit: "CALENDAR" | "WORKING";
  sampleCount: number;
  pendingCount: number;
  isTargetMet: boolean | null;
  annual: PeriodStatistic;
  months: Array<PeriodStatistic & { month: number }>;
  quarters: Array<PeriodStatistic & { quarter: number }>;
  regions: Array<PeriodStatistic & { region: string }>;
  notMetPreview: ServiceLevelSample[];
  notMetCount: number;
}

export interface UnavailableParameter {
  group: "NETWORK" | "NON_NETWORK";
  title: string;
  standardLabel: string;
  reason: string;
}

export interface SelfAssessmentSummary {
  year: number;
  generatedAt: string;
  parameters: ParameterSummary[];
  unavailable: UnavailableParameter[];
  notes: string[];
  warnings: { sitesWithoutRegion: string[]; lastHolidayDate: string | null };
}
