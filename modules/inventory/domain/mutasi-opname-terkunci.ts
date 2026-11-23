import {
  INVENTORY_USER_ERROR_STATUS,
  InventoryUserError,
} from "./inventory-user-error";

/**
 * Pesan saat barang masuk/keluar hasil stock opname hendak diubah atau dihapus
 * dari daftar Barang Masuk / Barang Keluar. Mutasi itu milik opname-nya:
 * mengubahnya di sini menggeser stok tanpa mengubah opname, lalu stok terbalik
 * dua kali saat opname-nya dihapus.
 */
export const MUTASI_OPNAME_TERKUNCI_PESAN =
  "Mutasi ini dibuat oleh stock opname. Koreksi lewat Riwayat Opname.";

/** Apakah barang masuk/keluar ini dicatat oleh stock opname. */
export function isMutasiOpname(record: { opnameId?: string | null }): boolean {
  return Boolean(record.opnameId);
}

/** Error 409 untuk ubah/hapus mutasi hasil stock opname. */
export function mutasiOpnameTerkunciError(): InventoryUserError {
  return new InventoryUserError(
    MUTASI_OPNAME_TERKUNCI_PESAN,
    INVENTORY_USER_ERROR_STATUS.CONFLICT,
  );
}

/** Tolak ubah/hapus bila barang masuk/keluar ini dicatat oleh stock opname. */
export function assertBukanMutasiOpname(record: {
  opnameId?: string | null;
}): void {
  if (isMutasiOpname(record)) throw mutasiOpnameTerkunciError();
}
