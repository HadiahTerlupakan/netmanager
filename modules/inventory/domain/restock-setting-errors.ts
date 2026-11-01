/** Data acuan pengaturan restock yang bisa hilang di tengah jalan. */
export type RestockSettingReference = "barang" | "gudang";

const RESTOCK_SETTING_REFERENCE_MESSAGES: Record<
  RestockSettingReference,
  string
> = {
  barang:
    "Barang ini tidak ditemukan. Mungkin sudah dihapus. Muat ulang halaman, lalu pilih barangnya lagi.",
  gudang:
    "Gudang ini tidak ditemukan atau sudah dinonaktifkan. Pilih gudang lain, atau minta admin mengaktifkannya lagi.",
};

/** Barang atau gudang untuk pengaturan restock tidak ada (lagi). */
export class RestockSettingReferenceError extends Error {
  constructor(readonly reference: RestockSettingReference) {
    super(RESTOCK_SETTING_REFERENCE_MESSAGES[reference]);
    this.name = "RestockSettingReferenceError";
  }
}
