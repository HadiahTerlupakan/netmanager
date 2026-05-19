/**
 * Pure helpers untuk memetakan opname → kondisi mutasi (BarangMasuk/Keluar).
 * Tidak menyentuh DB; aman untuk unit test.
 */

export type MovementKondisi = "BARU" | "BEKAS" | "RUSAK";

/**
 * Alasan administratif tidak menghasilkan record mutasi fisik karena
 * tidak merefleksikan pergerakan barang nyata. Hanya stok yang disesuaikan.
 */
export function isAdministrativeAdjustment(alasanSelisih?: string) {
  return alasanSelisih === "revisi" || alasanSelisih === "salah_input";
}

/**
 * Stok lebih (selisih positif) — kondisi diambil dari mayoritas
 * breakdown yang user input. Bila tidak ada breakdown, default `BARU`.
 */
export function resolvePositiveMovementCondition(input: {
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
}): MovementKondisi {
  const baik = input.kondisiBaik ?? 0;
  const rusak = input.kondisiRusak ?? 0;
  const bekas = input.kondisiExpire ?? 0;
  const total = baik + rusak + bekas;

  if (total === 0) return "BARU";

  const max = Math.max(baik, rusak, bekas);
  if (max === rusak) return "RUSAK";
  if (max === bekas) return "BEKAS";
  return "BARU";
}

/**
 * Stok kurang (selisih negatif) — kondisi diambil dari `alasanSelisih`.
 * `rusak` → RUSAK, `expired` → BEKAS, lainnya → BARU.
 */
export function resolveNegativeMovementCondition(
  alasanSelisih?: string,
): MovementKondisi {
  if (alasanSelisih === "rusak") return "RUSAK";
  if (alasanSelisih === "expired") return "BEKAS";
  return "BARU";
}
