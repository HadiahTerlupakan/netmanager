import {
  describeRestockValidationError,
  restockCancelSchema,
  type RestockCancelInput,
} from "@/lib/validations/restock";

/** Teks tombol dan judul modal pembatalan pengajuan yang sudah disetujui. */
export const CANCEL_REQUEST_LABEL = "Batalkan Pengajuan";

export const RESTOCK_REQUEST_CANCELLED_MESSAGE = "Pengajuan dibatalkan.";

/** Body PATCH /api/inventory/restock/requests/[id] untuk membatalkan pengajuan. */
export function buildRestockCancelPayload(reason: string): RestockCancelInput {
  return { action: "CANCEL", alasan: reason.trim() };
}

/**
 * Panjang alasan seperti yang dihitung server: tanpa spasi di awal dan akhir,
 * sama dengan yang dikirim dan diperiksa `restockCancelSchema`.
 */
export function getRestockCancelReasonLength(reason: string): number {
  return buildRestockCancelPayload(reason).alasan.length;
}

/**
 * Masalah alasan pembatalan menurut aturan yang sama dengan server; null bila
 * siap dikirim.
 */
export function getRestockCancelProblem(reason: string): string | null {
  const parsed = restockCancelSchema.safeParse(
    buildRestockCancelPayload(reason),
  );
  return parsed.success ? null : describeRestockValidationError(parsed.error);
}
