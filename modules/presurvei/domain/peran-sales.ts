/**
 * Siapa yang diperlakukan sebagai sales — fungsi murni, tanpa I/O.
 *
 * Kepala sales adalah bagian dari tim sales: role-nya boleh memberi rencana
 * dengan lingkup TIM. Admin (lingkup SEMUA) memang memantau sales, tapi bukan
 * sales. Aturan diturunkan dari role, bukan disalin ke kolom `User.isSales`,
 * supaya perubahan role langsung berlaku tanpa sinkronisasi data.
 */

import { jenisLingkupDariIzin } from "./rencana-rules";

/** Apakah daftar izin role menandai kepala sales (lingkup rencana TIM). */
export function isKepalaSalesDariIzin(permissions: string[]): boolean {
  return jenisLingkupDariIzin(permissions) === "TIM";
}

/** Sales efektif: ditandai sales di data user, atau kepala sales lewat role-nya. */
export function isSalesEfektif(input: { isSales: boolean; permissions: string[] }): boolean {
  return input.isSales || isKepalaSalesDariIzin(input.permissions);
}
