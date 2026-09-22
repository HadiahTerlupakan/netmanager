/**
 * Pemeriksaan "field ini benar-benar diisi" untuk seluruh validator presurvei.
 *
 * Ditaruh di berkas sendiri karena dua skema membutuhkannya: kegiatan (koordinat
 * dan data teknis) serta prospek (atribusi sumber). Menyalinnya ke masing-masing
 * validator berarti dua definisi yang bisa menyimpang.
 */

/**
 * Apakah sebuah field benar-benar diisi.
 *
 * Dipakai agar pemeriksaan tidak memakai truthiness: angka `0` adalah nilai
 * yang sah untuk koordinat (khatulistiwa, meridian) maupun estimasi kabel,
 * sedangkan `!0` bernilai true dan akan menganggapnya kosong. String yang hanya
 * berisi spasi dianggap kosong.
 */
export function isTerisi(nilai: unknown): boolean {
  if (nilai === null || nilai === undefined) return false;
  if (typeof nilai === "string") return nilai.trim().length > 0;
  return true;
}
