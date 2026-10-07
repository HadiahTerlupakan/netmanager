import { parametersOf, type LicenseScheme } from "./license-schemes";

/**
 * Isian dokumen Word Self-Assessment Komdigi: profil penyelenggara (disimpan
 * sekali) dan isian per tahun (nilai parameter yang belum dihitung sistem
 * serta link dokumen pendukung). Murni — tanpa I/O.
 */

export const DEFAULT_LICENSE_TYPE =
  "Jaringan Tetap Lokal Berbasis Packet Switched";
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

/**
 * Kunci parameter berasal dari katalog jenis izin (`license-schemes.ts`), bukan
 * daftar tetap: tiap izin punya parameter sendiri, dan ISP bahkan memakai
 * awalan blok (`seluler.`, `jartaplok.`). Union statis tidak bisa menyatakan
 * ruang kunci yang bergantung skema, jadi kesesuaiannya dijaga saat runtime
 * oleh validator terhadap `manualParametersOf(skema)`.
 */
export type ManualAchievementKey = string;
export type SupportingLinkKey = string;

export interface YearlyDocumentInput {
  /** Persen 0–100 sebagai teks ("99,62"); kosong = belum ada. */
  manualAchievements: Partial<Record<ManualAchievementKey, string>>;
  supportingLinks: Partial<Record<SupportingLinkKey, string>>;
}

export const EMPTY_YEARLY_INPUT: YearlyDocumentInput = {
  manualAchievements: {},
  supportingLinks: {},
};

/**
 * Capaian hitungan sistem untuk tahun laporan (rasio 0–1, null bila tanpa
 * data), berkunci `ParameterSpec.key` sesuai katalog jenis izinnya.
 */
export type ComputedAchievements = Record<string, number | null>;

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
  return Number.isNaN(date.getTime())
    ? isoDate
    : longDateFormatter.format(date);
}

export interface DocumentValueSource {
  year: number;
  scheme: LicenseScheme;
  profile: OperatorProfile;
  yearly: YearlyDocumentInput;
  computed: ComputedAchievements;
  /** Baris kontak kop surat (alamat · telepon · email). */
  letterheadContact: string;
  signingDate: Date;
}

/**
 * Nilai seluruh penanda isian template Word.
 *
 * Penanda parameter dirakit dari katalog jenis izin, bukan ditulis satu per
 * satu: formulir ISP punya 22 parameter dengan penamaan berblok, dan daftar
 * manual akan menyimpang diam-diam begitu katalog berubah.
 */
export function buildDocumentValues(
  source: DocumentValueSource,
): Record<string, string> {
  const { profile, yearly } = source;
  const links = yearly.supportingLinks;
  const manual = yearly.manualAchievements;

  const nilaiParameter: Record<string, string> = {};
  for (const parameter of parametersOf(source.scheme)) {
    nilaiParameter[parameter.placeholder] = parameter.auto
      ? formatAchievementRatio(source.computed[parameter.key] ?? null)
      : formatManualAchievement(manual[parameter.key]);
    nilaiParameter[`link_${parameter.placeholder}`] =
      links[parameter.key] ?? "";
  }

  return {
    ...nilaiParameter,
    tahun: String(source.year),
    nama_penyelenggara: profile.operatorName,
    jenis_izin: profile.licenseType,
    alamat_penyelenggara: profile.operatorAddress,
    nomor_izin: profile.licenseNumber,
    tanggal_izin: formatLicenseDate(profile.licenseDate),
    link_lampiran_izin: profile.licenseAttachmentUrl,
    kop_nama: [profile.operatorName.toUpperCase(), source.letterheadContact]
      .filter(Boolean)
      .join("\n"),
    tempat: profile.signingCity,
    tanggal_tanda_tangan: longDateFormatter.format(source.signingDate),
    nama_direktur: profile.directorName,
  };
}
