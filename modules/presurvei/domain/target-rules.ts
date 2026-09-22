import type { RealisasiTarget, TargetEntity } from "./entities/Target";

/**
 * Aturan pencapaian target presurvei — fungsi murni, tanpa I/O.
 */

const PERSEN_PENUH = 100;

/** Satu baris pencapaian: target, realisasi, dan persentasenya. */
export interface BarisPencapaian {
  target: number;
  tercapai: number;
  persen: number;
}

export interface Pencapaian {
  kunjungan: BarisPencapaian;
  prospek: BarisPencapaian;
  konversi: BarisPencapaian;
}

/**
 * Hitung pencapaian seorang sales terhadap targetnya.
 *
 * Persentase dibatasi pada 100 supaya bilah progres tidak melampaui bingkainya,
 * tapi `tercapai` tetap melaporkan angka sebenarnya — manajer perlu melihat
 * siapa yang jauh melampaui target, bukan sekadar bahwa ia lewat.
 */
export function hitungPencapaian(
  target: Pick<
    TargetEntity,
    "targetKunjungan" | "targetProspek" | "targetKonversi"
  >,
  realisasi: RealisasiTarget,
): Pencapaian {
  return {
    kunjungan: bangunBaris(target.targetKunjungan, realisasi.kunjungan),
    prospek: bangunBaris(target.targetProspek, realisasi.prospek),
    konversi: bangunBaris(target.targetKonversi, realisasi.konversi),
  };
}

function bangunBaris(target: number, tercapai: number): BarisPencapaian {
  return { target, tercapai, persen: hitungPersen(target, tercapai) };
}

/**
 * Persentase pencapaian, dibatasi 0–100.
 *
 * Target nol dianggap tercapai penuh: tidak ada yang bisa gagal dicapai, dan
 * mengembalikan Infinity atau NaN akan merusak pengurutan peringkat sales.
 */
function hitungPersen(target: number, tercapai: number): number {
  if (target <= 0) return PERSEN_PENUH;
  return Math.min(PERSEN_PENUH, Math.round((tercapai / target) * PERSEN_PENUH));
}
