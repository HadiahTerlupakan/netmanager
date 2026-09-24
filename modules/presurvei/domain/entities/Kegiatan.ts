/**
 * Entitas domain kegiatan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

import type { PeranPelaku } from "../peran-pelaku";

export const KEGIATAN_JENIS = [
  "KUNJUNGAN",
  "SURVEI_LOKASI",
  "TELEPON",
  "CHAT",
  "IKLAN",
] as const;

export type KegiatanJenis = (typeof KEGIATAN_JENIS)[number];

export const KEGIATAN_HASIL = [
  "TERTARIK",
  "PERLU_FOLLOWUP",
  "TIDAK_MINAT",
  "TIDAK_ADA_ORANG",
  "DEAL",
] as const;

export type KegiatanHasil = (typeof KEGIATAN_HASIL)[number];

export interface KegiatanEntity {
  id: string;
  jenis: KegiatanJenis;
  userId: string;
  /**
   * Label pelaku (`tentukanNamaSales`), null bila tidak bisa ditentukan —
   * termasuk bila `userId` menunjuk user di tenant lain (`namaSalesSatuTenant`).
   */
  namaSales: string | null;
  /**
   * Peran pelaku SAAT INI (`User.isSales`), bukan saat kegiatan dicatat;
   * null bila tidak bisa ditentukan — lihat `peranPelakuSatuTenant`.
   */
  peranPelaku: PeranPelaku | null;
  /** Nama departemen pelaku saat ini; null bila tidak ada atau dijaga tenant. */
  departemenPelaku: string | null;
  prospekId: string | null;
  iklanId: string | null;
  waktuMulai: Date;
  waktuSelesai: Date | null;
  latitude: number | null;
  longitude: number | null;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  hasil: KegiatanHasil;
  catatan: string | null;
  fotoUrls: string[];
  odpTerdekat: string | null;
  estimasiKabelMeter: number | null;
  catatanTeknis: string | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
