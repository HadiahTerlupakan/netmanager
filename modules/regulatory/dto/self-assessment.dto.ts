import type {
  MonthStatistic,
  PeriodStatistic,
  QuarterStatistic,
  RegionStatistic,
} from "../domain/service-level-aggregation";
import type { SampleOutcome } from "../domain/service-level-evaluation";
import type {
  ParameterReport,
  SelfAssessmentReport,
  ServiceLevelSample,
  UnavailableParameter,
} from "../domain/self-assessment-report";

/**
 * Ringkasan laporan untuk halaman. Seluruh sampel (bisa ribuan) hanya ada di
 * berkas Excel; halaman cukup menampilkan permohonan yang tidak memenuhi.
 */

const NOT_MET_PREVIEW_LIMIT = 20;

export interface ServiceLevelSampleDto {
  reference: string;
  startedAt: string;
  finishedAt: string | null;
  durationDays: number;
  outcome: SampleOutcome;
  siteName: string | null;
  region: string;
}

export interface ParameterSummaryDto {
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
  months: MonthStatistic[];
  quarters: QuarterStatistic[];
  regions: RegionStatistic[];
  /** Permohonan tidak memenuhi terbaru, untuk ditindaklanjuti. */
  notMetPreview: ServiceLevelSampleDto[];
  notMetCount: number;
}

export interface SelfAssessmentSummaryDto {
  year: number;
  generatedAt: string;
  parameters: ParameterSummaryDto[];
  unavailable: UnavailableParameter[];
  notes: string[];
  warnings: { sitesWithoutRegion: string[]; lastHolidayDate: string | null };
}

function toSampleDto(sample: ServiceLevelSample): ServiceLevelSampleDto {
  return {
    reference: sample.reference,
    startedAt: sample.startedAt.toISOString(),
    finishedAt: sample.finishedAt?.toISOString() ?? null,
    durationDays: sample.durationDays,
    outcome: sample.outcome,
    siteName: sample.siteName,
    region: sample.region,
  };
}

function toParameterSummary(report: ParameterReport): ParameterSummaryDto {
  const notMet = report.samples.filter(
    (sample) => sample.outcome === "NOT_MET",
  );
  const { parameter } = report;

  return {
    key: parameter.key,
    number: parameter.number,
    title: parameter.title,
    basis: parameter.basis,
    standardLabel: parameter.standardLabel,
    targetRatio: parameter.targetRatio,
    maxDays: parameter.maxDays,
    dayUnit: parameter.dayUnit,
    sampleCount: report.samples.length,
    pendingCount: report.pendingCount,
    isTargetMet: report.isTargetMet,
    annual: report.annual,
    months: report.months,
    quarters: report.quarters,
    regions: report.regions,
    notMetPreview: notMet
      .slice(-NOT_MET_PREVIEW_LIMIT)
      .reverse()
      .map(toSampleDto),
    notMetCount: notMet.length,
  };
}

/** Ringkasan laporan untuk dikirim ke halaman. */
export function toSelfAssessmentSummary(
  report: SelfAssessmentReport,
): SelfAssessmentSummaryDto {
  return {
    year: report.year,
    generatedAt: report.generatedAt.toISOString(),
    parameters: report.parameters.map(toParameterSummary),
    unavailable: report.unavailable,
    notes: report.notes,
    warnings: {
      sitesWithoutRegion: report.warnings.sitesWithoutRegion,
      lastHolidayDate: report.warnings.lastHolidayDate?.toISOString() ?? null,
    },
  };
}
