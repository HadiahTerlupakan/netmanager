/**
 * Pilihan alasan selisih opname untuk layar petugas. Nilainya sama dengan
 * kode alasan yang diterima server (`OPNAME_REASON_CODES`).
 */
export const ALASAN_SELISIH_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "hilang", label: "Hilang / Kehilangan" },
  { value: "rusak", label: "Rusak / Tidak Layak" },
  { value: "revisi", label: "Revisi Stok / Koreksi Data" },
  { value: "salah_input", label: "Kesalahan Input Sebelumnya" },
  { value: "terpakai", label: "Terpakai Tidak Tercatat" },
  { value: "expired", label: "Kadaluarsa / Expire" },
  { value: "lebih", label: "Stok Lebih / Ditemukan" },
  { value: "lainnya", label: "Lainnya" },
];

/** Label alasan selisih; string kosong bila kodenya tidak dikenal. */
export function labelAlasanSelisih(kode: string | null | undefined): string {
  return ALASAN_SELISIH_OPTIONS.find((opt) => opt.value === kode)?.label ?? "";
}
