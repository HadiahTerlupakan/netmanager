/**
 * Penanda kepala sales dari izin role — fungsi murni, tanpa I/O.
 *
 * Kepala sales = role yang boleh memberi rencana kunjungan dengan lingkup TIM.
 * Ini BUKAN penentu "siapa sales": satu-satunya penentu sales adalah persona
 * role (`isSalesDariPersona` di modul roles). Fungsi ini dipakai form role
 * untuk menyarankan persona Sales bagi role kepala sales.
 */

import { jenisLingkupDariIzin } from "./rencana-rules";

/** Apakah daftar izin role menandai kepala sales (lingkup rencana TIM). */
export function isKepalaSalesDariIzin(permissions: string[]): boolean {
  return jenisLingkupDariIzin(permissions) === "TIM";
}
