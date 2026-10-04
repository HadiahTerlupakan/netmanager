/** Isian formulir dokumen Word Self-Assessment di sisi klien. */

export interface OperatorProfile {
  operatorName: string;
  licenseType: string;
  operatorAddress: string;
  licenseNumber: string;
  licenseDate: string;
  licenseAttachmentUrl: string;
  signingCity: string;
  directorName: string;
}

export type ManualAchievementKey = "packetLoss" | "latency" | "availability" | "complaints";
export type SupportingLinkKey =
  | "packetLoss"
  | "latency"
  | "availability"
  | "newInstallation"
  | "restoration"
  | "complaints";

export interface YearlyDocumentInput {
  manualAchievements: Partial<Record<ManualAchievementKey, string>>;
  supportingLinks: Partial<Record<SupportingLinkKey, string>>;
}

export interface DocumentForm {
  year: number;
  profile: OperatorProfile;
  yearly: YearlyDocumentInput;
  computed: { newInstallation: number | null; restoration: number | null };
}

export const PROFILE_FIELDS: ReadonlyArray<{
  key: keyof OperatorProfile;
  label: string;
  placeholder: string;
  type?: "date" | "url";
}> = [
  { key: "operatorName", label: "Nama penyelenggara", placeholder: "PT Surya Bestari Lestari" },
  { key: "licenseType", label: "Jenis izin penyelenggaraan", placeholder: "Jaringan Tetap Lokal Berbasis Packet Switched" },
  { key: "operatorAddress", label: "Alamat penyelenggara", placeholder: "Alamat kantor sesuai izin" },
  { key: "licenseNumber", label: "Nomor izin", placeholder: "Nomor izin penyelenggaraan" },
  { key: "licenseDate", label: "Tanggal izin", placeholder: "", type: "date" },
  { key: "licenseAttachmentUrl", label: "Link lampiran izin", placeholder: "https://…", type: "url" },
  { key: "signingCity", label: "Kota penandatanganan", placeholder: "Cianjur" },
  { key: "directorName", label: "Nama Direktur Utama", placeholder: "Nama lengkap" },
];

/** Baris parameter di formulir: capaian dari sistem (`computed`) atau diketik (`manual`). */
export const PARAMETER_ROWS: ReadonlyArray<{
  linkKey: SupportingLinkKey;
  label: string;
  standard: string;
  source: { kind: "manual"; key: ManualAchievementKey } | { kind: "computed"; key: keyof DocumentForm["computed"] };
}> = [
  { linkKey: "packetLoss", label: "Packet loss (drop rate)", standard: "≤ 5%", source: { kind: "manual", key: "packetLoss" } },
  { linkKey: "latency", label: "Network latency ≤ 250 mdet", standard: "≥ 90%", source: { kind: "manual", key: "latency" } },
  { linkKey: "availability", label: "Network availability", standard: "≥ 99%", source: { kind: "manual", key: "availability" } },
  { linkKey: "newInstallation", label: "Pemenuhan pasang baru ≤ 7 hari", standard: "≥ 90%", source: { kind: "computed", key: "newInstallation" } },
  { linkKey: "restoration", label: "Pemulihan layanan ≤ 2 hari kerja", standard: "≥ 90%", source: { kind: "computed", key: "restoration" } },
  { linkKey: "complaints", label: "Penyelesaian keluhan ≤ 3 hari kerja", standard: "≥ 90%", source: { kind: "manual", key: "complaints" } },
];
