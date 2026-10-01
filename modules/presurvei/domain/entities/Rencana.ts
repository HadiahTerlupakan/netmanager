/**
 * Entitas domain rencana kunjungan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

import type { KegiatanJenis } from "./Kegiatan";

/** Asal rencana: dibuat sales sendiri, atau ditugaskan admin/kepala sales. */
export const RENCANA_SUMBER = ["MANDIRI", "PENUGASAN"] as const;
export type RencanaSumber = (typeof RENCANA_SUMBER)[number];

/** Status yang tersimpan di database. */
export const RENCANA_STATUS = ["DIRENCANAKAN", "SELESAI", "BATAL"] as const;
export type RencanaStatus = (typeof RENCANA_STATUS)[number];

/**
 * Status yang ditampilkan. TERLEWAT tidak pernah disimpan: ia DIRENCANAKAN
 * yang tanggalnya sudah lewat (`tentukanStatusTampil`), sehingga tidak perlu
 * job harian untuk menandainya.
 */
export const RENCANA_STATUS_TAMPIL = [
  "DIRENCANAKAN",
  "TERLEWAT",
  "SELESAI",
  "BATAL",
] as const;
export type RencanaStatusTampil = (typeof RENCANA_STATUS_TAMPIL)[number];

/** Jenis kegiatan yang bisa direncanakan — iklan bukan kunjungan ke calon pelanggan. */
export const RENCANA_JENIS = [
  "KUNJUNGAN",
  "SURVEI_LOKASI",
  "TELEPON",
  "CHAT",
] as const satisfies readonly KegiatanJenis[];
export type RencanaJenis = (typeof RENCANA_JENIS)[number];

export const TUJUAN_RENCANA_MAKS = 500;
export const ALAMAT_RENCANA_MAKS = 300;
export const ALASAN_BATAL_MIN = 3;
export const ALASAN_BATAL_MAKS = 300;

export interface RencanaEntity {
  id: string;
  salesId: string;
  namaSales: string | null;
  dibuatOlehId: string;
  namaPembuat: string | null;
  sumber: RencanaSumber;
  jenis: RencanaJenis;
  /** Tanggal kalender rencana, "YYYY-MM-DD" (kolom DATE, tanpa jam). */
  tanggal: string;
  /** Jam rencana "HH:mm" waktu lokal tenant; null = kapan saja di hari itu. */
  jam: string | null;
  tujuan: string;
  prospekId: string | null;
  namaProspek: string | null;
  alamat: string | null;
  latitude: number | null;
  longitude: number | null;
  status: RencanaStatus;
  kegiatanId: string | null;
  dilaporkanAt: Date | null;
  alasanBatal: string | null;
  dibatalkanOlehId: string | null;
  dibatalkanAt: Date | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
