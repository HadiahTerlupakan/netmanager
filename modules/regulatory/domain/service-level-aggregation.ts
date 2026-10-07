import type { SampleOutcome } from "./service-level-evaluation";

/**
 * Agregasi statistik sesuai contoh Komdigi: bukan rata-rata sederhana tetapi
 * rata-rata tertimbang S = Σ(Ni × Si) / Σ(Ni). Karena Si = memenuhi_i / Ni,
 * hasilnya sama dengan Σ memenuhi / Σ diterima — itu yang dihitung di sini.
 */

export const MONTHS_PER_YEAR = 12;
const MONTHS_PER_QUARTER = 3;
const QUARTERS_PER_YEAR = 4;

export interface PeriodStatistic {
  /** Permohonan yang sudah bisa dinilai (N). */
  received: number;
  /** Permohonan yang memenuhi standar. */
  met: number;
  /** met / received; null bila tidak ada permohonan. */
  ratio: number | null;
}

export interface MonthStatistic extends PeriodStatistic {
  month: number;
}

export interface QuarterStatistic extends PeriodStatistic {
  quarter: number;
}

export interface RegionStatistic extends PeriodStatistic {
  region: string;
}

export interface AggregatableSample {
  month: number;
  region: string;
  outcome: SampleOutcome;
}

function statisticOf(received: number, met: number): PeriodStatistic {
  return { received, met, ratio: received > 0 ? met / received : null };
}

/** Gabungkan beberapa periode dengan bobot jumlah permohonan masing-masing. */
export function combinePeriods(periods: PeriodStatistic[]): PeriodStatistic {
  const received = periods.reduce((sum, period) => sum + period.received, 0);
  const met = periods.reduce((sum, period) => sum + period.met, 0);
  return statisticOf(received, met);
}

function countAssessable(samples: AggregatableSample[]): PeriodStatistic {
  const assessable = samples.filter((sample) => sample.outcome !== "PENDING");
  const met = assessable.filter((sample) => sample.outcome === "MET").length;
  return statisticOf(assessable.length, met);
}

/** Statistik bulanan Januari–Desember (bulan tanpa permohonan tetap tampil). */
export function aggregateByMonth(
  samples: AggregatableSample[],
): MonthStatistic[] {
  return Array.from({ length: MONTHS_PER_YEAR }, (_, index) => {
    const month = index + 1;
    return {
      month,
      ...countAssessable(samples.filter((sample) => sample.month === month)),
    };
  });
}

/** Statistik kuartalan dari statistik bulanan, tertimbang jumlah permohonan. */
export function aggregateByQuarter(
  months: MonthStatistic[],
): QuarterStatistic[] {
  return Array.from({ length: QUARTERS_PER_YEAR }, (_, index) => {
    const quarterMonths = months.slice(
      index * MONTHS_PER_QUARTER,
      (index + 1) * MONTHS_PER_QUARTER,
    );
    return { quarter: index + 1, ...combinePeriods(quarterMonths) };
  });
}

/** Statistik per kabupaten/kota, diurutkan dari yang permohonannya terbanyak. */
export function aggregateByRegion(
  samples: AggregatableSample[],
): RegionStatistic[] {
  const regions = [...new Set(samples.map((sample) => sample.region))];
  return regions
    .map((region) => ({
      region,
      ...countAssessable(samples.filter((sample) => sample.region === region)),
    }))
    .sort(
      (left, right) =>
        right.received - left.received ||
        left.region.localeCompare(right.region),
    );
}

/** Apakah capaian memenuhi target; tanpa permohonan dianggap belum bisa dinilai (null). */
export function isTargetMet(
  statistic: PeriodStatistic,
  targetRatio: number,
): boolean | null {
  return statistic.ratio === null ? null : statistic.ratio >= targetRatio;
}
