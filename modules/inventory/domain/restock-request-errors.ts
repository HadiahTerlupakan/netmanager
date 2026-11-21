/** Didefinisikan di restock-request-status.ts; diekspor ulang untuk pemakai yang sudah ada. */
export { RESTOCK_EDITABLE_STATUSES } from "./restock-request-status";

/**
 * Pengajuan sudah diputuskan, sudah punya pesanan, atau dihapus setelah pemohon
 * membuka form ubah. `currentStatus` null berarti pengajuannya sudah tidak ada.
 */
export class RestockRequestNotEditableError extends Error {
  constructor(readonly currentStatus: string | null) {
    super("Purchase request is no longer editable");
    this.name = "RestockRequestNotEditableError";
  }
}

/** Cek apakah error adalah {@link RestockRequestNotEditableError}. */
export function isRestockRequestNotEditableError(
  error: unknown,
): error is RestockRequestNotEditableError {
  return error instanceof RestockRequestNotEditableError;
}
