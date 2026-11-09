/** Status pengajuan restock yang isinya masih boleh diubah pemohon. */
export const RESTOCK_EDITABLE_STATUSES = ["DRAFT", "SUBMITTED"] as const;

/**
 * Pengajuan sudah diputuskan (atau dihapus) setelah pemohon membuka form ubah.
 * `currentStatus` null berarti pengajuannya sudah tidak ada.
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
