import type { IklanEntity } from "./entities/Iklan";

/**
 * Aturan bisnis iklan presurvei — fungsi murni, tanpa I/O.
 */

/**
 * Apakah iklan sedang berjalan pada suatu tanggal.
 *
 * Penanda `isAktif` menyatakan niat pemiliknya, tanggal menyatakan kenyataannya;
 * keduanya harus benar. Batas tanggalnya inklusif — iklan yang selesai hari ini
 * masih boleh menerima prospek yang masuk hari ini.
 */
export function isIklanBerjalan(
  iklan: Pick<IklanEntity, "isAktif" | "tanggalMulai" | "tanggalSelesai">,
  pada: Date = new Date(),
): boolean {
  if (!iklan.isAktif) return false;
  if (iklan.tanggalMulai.getTime() > pada.getTime()) return false;
  if (!iklan.tanggalSelesai) return true;
  return iklan.tanggalSelesai.getTime() >= pada.getTime();
}
