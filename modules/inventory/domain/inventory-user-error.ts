/** Status HTTP untuk masalah yang penyebabnya ada di pihak pengguna. */
export const INVENTORY_USER_ERROR_STATUS = {
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const;

export type InventoryUserErrorStatus =
  (typeof INVENTORY_USER_ERROR_STATUS)[keyof typeof INVENTORY_USER_ERROR_STATUS];

/**
 * Masalah inventory yang bisa dibereskan pengguna sendiri (stok kurang, jumlah
 * salah, data sudah dihapus). Pesannya ditulis untuk staf gudang dan aman
 * ditampilkan apa adanya; `status` dipakai route — termasuk route mobile, yang
 * meneruskan pesan error apa pun yang punya `status` angka.
 */
export class InventoryUserError extends Error {
  constructor(
    message: string,
    readonly status: InventoryUserErrorStatus = INVENTORY_USER_ERROR_STATUS.BAD_REQUEST,
  ) {
    super(message);
    this.name = "InventoryUserError";
  }
}

/** Cek apakah error adalah {@link InventoryUserError}. */
export function isInventoryUserError(
  error: unknown,
): error is InventoryUserError {
  return error instanceof InventoryUserError;
}

const KONDISI_LABELS: Record<string, string> = {
  BARU: "Baru",
  BEKAS: "Bekas",
  RUSAK: "Rusak",
};

/** Nama kondisi barang yang dibaca staf ("Baru", "Bekas", "Rusak"). */
export function labelKondisiBarang(kondisi: string | null | undefined): string {
  if (!kondisi) return KONDISI_LABELS.BARU;
  return KONDISI_LABELS[kondisi] ?? kondisi;
}

/** Pesan bersama barang masuk/keluar yang dipakai lebih dari satu lapisan. */
export const MUTASI_STOK_PESAN = {
  masukTidakDitemukan:
    "Catatan barang masuk ini tidak ditemukan, mungkin sudah dihapus orang lain. Muat ulang halaman.",
  keluarTidakDitemukan:
    "Catatan barang keluar ini tidak ditemukan, mungkin sudah dihapus orang lain. Muat ulang halaman.",
  catatanBedaSite:
    "Catatan ini milik gudang di site lain, jadi Anda tidak bisa membuka atau mengubahnya. Minta admin kalau Anda perlu akses.",
} as const;
