import type {
  MonthStatistic,
  PeriodStatistic,
  QuarterStatistic,
  RegionStatistic,
} from "./service-level-aggregation";
import type { SampleOutcome } from "./service-level-evaluation";
import type { ServiceLevelParameter } from "./service-level-standards";

/** Bentuk laporan Self-Assessment Komdigi yang dipakai halaman dan berkas Excel. */

export interface ServiceLevelSample {
  reference: string;
  submittedAt: Date;
  startedAt: Date;
  finishedAt: Date | null;
  durationDays: number;
  outcome: SampleOutcome;
  siteName: string | null;
  region: string;
}

export interface ParameterReport {
  parameter: ServiceLevelParameter;
  samples: ServiceLevelSample[];
  months: MonthStatistic[];
  quarters: QuarterStatistic[];
  annual: PeriodStatistic;
  regions: RegionStatistic[];
  /** Belum selesai dan masih dalam batas waktu — belum ikut dihitung. */
  pendingCount: number;
  isTargetMet: boolean | null;
}

/** Parameter yang belum bisa dihitung karena datanya belum direkam sistem. */
export interface UnavailableParameter {
  group: "NETWORK" | "NON_NETWORK";
  title: string;
  standardLabel: string;
  reason: string;
}

export interface DataWarnings {
  /** Site yang punya permohonan tetapi kabupaten/kotanya belum diisi. */
  sitesWithoutRegion: string[];
  /** Tanggal libur terakhir yang tercatat pada tahun laporan; null bila kosong. */
  lastHolidayDate: Date | null;
}

export interface SelfAssessmentReport {
  year: number;
  generatedAt: Date;
  parameters: ParameterReport[];
  unavailable: UnavailableParameter[];
  notes: string[];
  warnings: DataWarnings;
}
