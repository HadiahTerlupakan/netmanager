/**
 * Aturan murni yang memetakan selisih opname ke mutasi barang (masuk/keluar):
 * kondisinya, jumlahnya, dan teks keterangannya. Tidak menyentuh basis data.
 */

import type { KondisiStok } from "./opname-stock-condition";

export type MovementKondisi = KondisiStok;

export const INVENTORY_OPNAME_REASON_LABELS: Record<string, string> = {
  hilang: "Barang hilang",
  rusak: "Barang rusak/tidak layak",
  revisi: "Revisi stok/koreksi data",
  salah_input: "Kesalahan input sebelumnya",
  terpakai: "Terpakai tidak tercatat",
  expired: "Barang kadaluarsa",
  lebih: "Stok lebih/ditemukan",
  lainnya: "Lainnya",
};

const DEFAULT_REASON_LABEL = "Penyesuaian stok";

/** Ambil label alasan selisih opname yang ramah pengguna. */
export function resolveOpnameReasonLabel(alasanSelisih?: string | null) {
  if (!alasanSelisih) return DEFAULT_REASON_LABEL;
  return INVENTORY_OPNAME_REASON_LABELS[alasanSelisih] || alasanSelisih;
}

/**
 * Alasan administratif tidak menghasilkan record mutasi fisik karena
 * tidak merefleksikan pergerakan barang nyata. Hanya stok yang disesuaikan.
 */
export function isAdministrativeAdjustment(alasanSelisih?: string | null) {
  return alasanSelisih === "revisi" || alasanSelisih === "salah_input";
}

/**
 * Stok lebih (selisih positif) — kondisi diambil dari mayoritas
 * breakdown yang user input. Bila tidak ada breakdown, default `BARU`.
 */
export function resolvePositiveMovementCondition(input: {
  kondisiBaik?: number | null;
  kondisiRusak?: number | null;
  kondisiExpire?: number | null;
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
  alasanSelisih?: string | null,
): MovementKondisi {
  if (alasanSelisih === "rusak") return "RUSAK";
  if (alasanSelisih === "expired") return "BEKAS";
  return "BARU";
}

/** Mutasi yang harus dicatat untuk satu opname. */
export interface OpnameMovementPlan {
  arah: "MASUK" | "KELUAR";
  jumlah: number;
  kondisi: MovementKondisi;
  isHilang: boolean;
  keterangan: string;
}

/** Data opname yang menentukan mutasinya. */
export interface OpnameMovementSource {
  opnameId: string;
  selisih: number;
  alasanSelisih?: string | null;
  kondisiBaik?: number | null;
  kondisiRusak?: number | null;
  kondisiExpire?: number | null;
}

/**
 * Rencanakan mutasi untuk selisih opname. `null` bila tidak ada selisih atau
 * alasannya administratif — stok tetap disesuaikan, tetapi tanpa mutasi.
 */
export function planOpnameMovement(
  source: OpnameMovementSource,
): OpnameMovementPlan | null {
  if (source.selisih === 0) return null;
  if (isAdministrativeAdjustment(source.alasanSelisih)) return null;

  const alasanText = resolveOpnameReasonLabel(source.alasanSelisih);
  if (source.selisih > 0) {
    return {
      arah: "MASUK",
      jumlah: source.selisih,
      kondisi: resolvePositiveMovementCondition(source),
      isHilang: false,
      keterangan: `Opname: ${alasanText} (+${source.selisih}). Ref: ${source.opnameId}`,
    };
  }

  return {
    arah: "KELUAR",
    jumlah: Math.abs(source.selisih),
    kondisi: resolveNegativeMovementCondition(source.alasanSelisih),
    isHilang: source.alasanSelisih === "hilang",
    keterangan: `Opname: ${alasanText} (${source.selisih}). Ref: ${source.opnameId}`,
  };
}

/**
 * Kondisi stok yang menanggung selisih opname: kondisi mutasinya, atau BARU
 * untuk penyesuaian tanpa mutasi.
 */
export function resolveOpnameStockCondition(
  plan: OpnameMovementPlan | null,
): MovementKondisi {
  return plan?.kondisi ?? "BARU";
}
