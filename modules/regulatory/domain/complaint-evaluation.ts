import type {
  AutoComputation,
  ParameterSpec,
  TargetDirection,
} from "./license-schemes";
import type { TicketCounts } from "./ports/self-assessment-sources";

/**
 * Capaian parameter ISP yang berbasis keluhan pelanggan — fungsi murni.
 *
 * Rumusnya mengikuti `Panduan Pelaporan QoS ISP.pdf`, dan yang membedakannya
 * dari parameter work order adalah penyebutnya berpindah-pindah: keluhan
 * akurasi tagihan dibagi jumlah tagihan, laporan gangguan dibagi jumlah
 * pelanggan, sedangkan keluhan umum dibagi keluhan yang diterima.
 */

export interface ComplaintInputs {
  counts: TicketCounts;
  /** Jumlah tagihan pada periode; penyebut parameter akurasi tagihan. */
  invoices: number;
  /** Jumlah pelanggan pada akhir periode; penyebut tingkat laporan gangguan. */
  customers: number;
}

export interface ComplaintOutcome {
  ratio: number | null;
  /** Pembilang & penyebut yang dipakai, supaya angka di dokumen bisa ditelusuri. */
  numerator: number;
  denominator: number;
  meetsTarget: boolean | null;
}

/** Rasio aman: penyebut nol berarti "tidak ada data", bukan nol persen. */
function ratioOf(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/**
 * Apakah capaian memenuhi tolok ukur.
 *
 * Arah tolok ukur ikut dinilai: parameter keluhan dan gangguan berbentuk batas
 * atas (≤), sehingga "lebih besar" justru berarti gagal — kebalikan dari
 * parameter pemenuhan yang berbentuk batas bawah (≥).
 */
export function meetsTarget(
  ratio: number | null,
  targetRatio: number,
  direction: TargetDirection,
): boolean | null {
  if (ratio === null) return null;
  return direction === "MIN" ? ratio >= targetRatio : ratio <= targetRatio;
}

/** Hitung satu parameter berbasis keluhan sesuai jenis perhitungannya. */
export function evaluateComplaintParameter(
  parameter: ParameterSpec,
  inputs: ComplaintInputs,
): ComplaintOutcome {
  const { numerator, denominator } = pembilangPenyebut(parameter.auto, inputs);
  const ratio = ratioOf(numerator, denominator);

  return {
    ratio,
    numerator,
    denominator,
    meetsTarget: meetsTarget(
      ratio,
      parameter.targetRatio,
      parameter.targetDirection,
    ),
  };
}

function pembilangPenyebut(
  auto: AutoComputation | undefined,
  inputs: ComplaintInputs,
): { numerator: number; denominator: number } {
  switch (auto?.kind) {
    case "TICKET_PER_INVOICE":
      return {
        numerator: inputs.counts.received,
        denominator: inputs.invoices,
      };
    case "TICKET_PER_CUSTOMER":
      return {
        numerator: inputs.counts.received,
        denominator: inputs.customers,
      };
    case "TICKET_RESOLVED":
      return {
        numerator: inputs.counts.resolved,
        denominator: inputs.counts.received,
      };
    case "TICKET_RESOLVED_WITHIN":
      return {
        numerator: inputs.counts.resolvedWithinLimit,
        denominator: inputs.counts.resolved,
      };
    default:
      return { numerator: 0, denominator: 0 };
  }
}

/** Apakah parameter ini dihitung dari keluhan (bukan dari work order). */
export function isComplaintParameter(parameter: ParameterSpec): boolean {
  const kind = parameter.auto?.kind;
  return (
    kind === "TICKET_PER_INVOICE" ||
    kind === "TICKET_PER_CUSTOMER" ||
    kind === "TICKET_RESOLVED" ||
    kind === "TICKET_RESOLVED_WITHIN"
  );
}
