/**
 * Entitas domain kegiatan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

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
