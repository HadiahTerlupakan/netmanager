/**
 * Isian dokumen Word Self-Assessment Komdigi: profil penyelenggara (disimpan
 * sekali) dan isian per tahun (nilai parameter yang belum dihitung sistem
 * serta link dokumen pendukung). Murni — tanpa I/O.
 */

export const DEFAULT_LICENSE_TYPE = "Jaringan Tetap Lokal Berbasis Packet Switched";
export const EMPTY_ACHIEVEMENT = "-";

export interface OperatorProfile {
  operatorName: string;
  licenseType: string;
  operatorAddress: string;
  licenseNumber: string;
  /** "YYYY-MM-DD" atau kosong. */
  licenseDate: string;
  licenseAttachmentUrl: string;
  signingCity: string;
  directorName: string;
}

/** Parameter yang nilainya diketik manual (belum dihitung sistem). */
export const MANUAL_ACHIEVEMENT_KEYS = ["packetLoss", "latency", "availability", "complaints"] as const;
export type ManualAchievementKey = (typeof MANUAL_ACHIEVEMENT_KEYS)[number];

/** Parameter yang punya kolom "Link Dokumen Pendukung". */
export const SUPPORTING_LINK_KEYS = [
  "packetLoss",
  "latency",
  "availability",
  "newInstallation",
  "restoration",
  "complaints",
] as const;
export type SupportingLinkKey = (typeof SUPPORTING_LINK_KEYS)[number];

export interface YearlyDocumentInput {
  /** Persen 0–100 sebagai teks ("99,62"); kosong = belum ada. */
  manualAchievements: Partial<Record<ManualAchievementKey, string>>;
  supportingLinks: Partial<Record<SupportingLinkKey, string>>;
}

export const EMPTY_YEARLY_INPUT: YearlyDocumentInput = { manualAchievements: {}, supportingLinks: {} };

/** Capaian yang dihitung sistem untuk tahun laporan (rasio 0–1, null bila tanpa data). */
export interface ComputedAchievements {
  newInstallation: number | null;
  restoration: number | null;
}

/** Persen Indonesia dua desimal, mis. 0.984 → "98,40%". */
export function formatAchievementRatio(ratio: number | null): string {
  if (ratio === null) return EMPTY_ACHIEVEMENT;
  return `${(ratio * 100).toFixed(2).replace(".", ",")}%`;
}

/** Isian persen manual ("99,62" / "99.62") → "99,62%"; kosong/tidak valid → "-". */
export function formatManualAchievement(value: string | undefined): string {
  const normalized = value?.trim().replace(",", ".");
  if (!normalized) return EMPTY_ACHIEVEMENT;
  const percent = Number(normalized);
  if (!Number.isFinite(percent)) return EMPTY_ACHIEVEMENT;
  return `${percent.toFixed(2).replace(".", ",")}%`;
}

const longDateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** "YYYY-MM-DD" → "12 Maret 2024"; kosong tetap kosong. */
export function formatLicenseDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? isoDate : longDateFormatter.format(date);
}

export interface DocumentValueSource {
  year: number;
  profile: OperatorProfile;
  yearly: YearlyDocumentInput;
  computed: ComputedAchievements;
  /** Baris kontak kop surat (alamat · telepon · email). */
  letterheadContact: string;
  signingDate: Date;
}

/** Nilai seluruh penanda isian template Word Komdigi. */
export function buildDocumentValues(source: DocumentValueSource): Record<string, string> {
  const { profile, yearly } = source;
  const links = yearly.supportingLinks;
  const manual = yearly.manualAchievements;

  return {
    tahun: String(source.year),
    nama_penyelenggara: profile.operatorName,
    jenis_izin: profile.licenseType,
    alamat_penyelenggara: profile.operatorAddress,
    nomor_izin: profile.licenseNumber,
    tanggal_izin: formatLicenseDate(profile.licenseDate),
    link_lampiran_izin: profile.licenseAttachmentUrl,
    packet_loss: formatManualAchievement(manual.packetLoss),
    latency: formatManualAchievement(manual.latency),
    availability: formatManualAchievement(manual.availability),
    keluhan: formatManualAchievement(manual.complaints),
    pasang_baru: formatAchievementRatio(source.computed.newInstallation),
    pemulihan: formatAchievementRatio(source.computed.restoration),
    link_packet_loss: links.packetLoss ?? "",
    link_latency: links.latency ?? "",
    link_availability: links.availability ?? "",
    link_pasang_baru: links.newInstallation ?? "",
    link_pemulihan: links.restoration ?? "",
    link_keluhan: links.complaints ?? "",
    kop_nama: [profile.operatorName.toUpperCase(), source.letterheadContact].filter(Boolean).join("\n"),
    tempat: profile.signingCity,
    tanggal_tanda_tangan: longDateFormatter.format(source.signingDate),
    nama_direktur: profile.directorName,
  };
}
