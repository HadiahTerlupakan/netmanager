import type { ServiceLevelParameter } from "./service-level-standards";
import { countCalendarDays, countWorkingDays } from "./wib-calendar";

/**
 * Penilaian satu permohonan terhadap standar. Permohonan yang belum selesai
 * tetap dinilai bila batas waktunya sudah lewat (pasti tidak memenuhi);
 * yang belum selesai dan masih dalam batas belum bisa dinilai.
 */

export type SampleOutcome = "MET" | "NOT_MET" | "PENDING";

export interface SampleTiming {
  /** Awal hitungan durasi (persetujuan untuk pasang baru, pengajuan untuk pemulihan). */
  startedAt: Date;
  finishedAt: Date | null;
}

export interface SampleEvaluation {
  /** Durasi sampai selesai; untuk yang belum selesai, durasi sampai `now`. */
  durationDays: number;
  outcome: SampleOutcome;
}

function durationBetween(
  parameter: ServiceLevelParameter,
  start: Date,
  end: Date,
  holidayKeys: ReadonlySet<string>,
): number {
  return parameter.dayUnit === "WORKING"
    ? countWorkingDays(start, end, holidayKeys)
    : countCalendarDays(start, end);
}

/** Nilai satu permohonan: memenuhi, tidak memenuhi, atau belum bisa dinilai. */
export function evaluateSample(
  parameter: ServiceLevelParameter,
  timing: SampleTiming,
  context: { now: Date; holidayKeys: ReadonlySet<string> },
): SampleEvaluation {
  const end = timing.finishedAt ?? context.now;
  const durationDays = Math.max(
    0,
    durationBetween(parameter, timing.startedAt, end, context.holidayKeys),
  );
  const isWithinLimit = durationDays <= parameter.maxDays;

  if (timing.finishedAt) {
    return { durationDays, outcome: isWithinLimit ? "MET" : "NOT_MET" };
  }
  return { durationDays, outcome: isWithinLimit ? "PENDING" : "NOT_MET" };
}
