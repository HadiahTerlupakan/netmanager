/**
 * Parameter standar mutu layanan non-jaringan (Perdirjen 7 Tahun 2024) yang
 * dihitung dari work order.
 */

export type DayUnit = "CALENDAR" | "WORKING";

export const SERVICE_LEVEL_PARAMETER_KEYS = [
  "PASANG_BARU",
  "PEMULIHAN_LAYANAN",
] as const;
export type ServiceLevelParameterKey =
  (typeof SERVICE_LEVEL_PARAMETER_KEYS)[number];

export interface ServiceLevelParameter {
  key: ServiceLevelParameterKey;
  number: number;
  title: string;
  basis: string;
  /** Batas durasi agar satu permohonan dinyatakan memenuhi standar. */
  maxDays: number;
  dayUnit: DayUnit;
  /** Porsi minimal permohonan yang memenuhi standar, mis. 0.9 = 90%. */
  targetRatio: number;
  standardLabel: string;
  /** Judul kolom Lampiran I, mengikuti format Komdigi untuk parameter ini. */
  columns: {
    reference: string;
    /** Kolom ke-3 dan ke-4: waktu mana yang ditampilkan, beserta judulnya. */
    firstTime: { header: string; field: SampleTimeField };
    secondTime: { header: string; field: SampleTimeField };
    duration: string;
    isMet: string;
    note: string;
  };
}

/** Waktu pada satu sampel yang bisa ditampilkan di kolom Lampiran I. */
export type SampleTimeField = "submittedAt" | "startedAt" | "finishedAt";

const PERDIRJEN_7_2024 = "Perdirjen 7 Tahun 2024";
const TARGET_RATIO = 0.9;

export const SERVICE_LEVEL_PARAMETERS: Record<
  ServiceLevelParameterKey,
  ServiceLevelParameter
> = {
  PASANG_BARU: {
    key: "PASANG_BARU",
    number: 1,
    title: "Standar Pemenuhan Permohonan Pasang Baru",
    basis: PERDIRJEN_7_2024,
    maxDays: 7,
    dayUnit: "CALENDAR",
    targetRatio: TARGET_RATIO,
    standardLabel: "≥ 90% diselesaikan ≤ 7 hari kalender sejak disetujui",
    columns: {
      reference: "Daftar Pemohon Pasang Baru yang Disetujui",
      firstTime: {
        header: "Tanggal & Waktu Pengajuan (dd/mm/yyyy hh:mm:ss)",
        field: "submittedAt",
      },
      secondTime: {
        header: "Tanggal & Waktu Persetujuan (dd/mm/yyyy hh:mm:ss)",
        field: "startedAt",
      },
      duration: "Durasi Pasang (hari kalender sejak persetujuan)",
      isMet: "Memenuhi Standar ≤ 7 Hari (Ya/Tidak)",
      note: "Keterangan",
    },
  },
  PEMULIHAN_LAYANAN: {
    key: "PEMULIHAN_LAYANAN",
    number: 2,
    title: "Standar Penyelesaian Permohonan Pemulihan Layanan",
    basis: PERDIRJEN_7_2024,
    maxDays: 2,
    dayUnit: "WORKING",
    targetRatio: TARGET_RATIO,
    standardLabel: "≥ 90% diselesaikan ≤ 2 hari kerja",
    columns: {
      reference: "Daftar Pemohon Pemulihan Layanan",
      firstTime: {
        header: "Tanggal & Waktu Pengajuan (dd/mm/yyyy hh:mm:ss)",
        field: "submittedAt",
      },
      secondTime: {
        header: "Tanggal & Waktu Penyelesaian (dd/mm/yyyy hh:mm:ss)",
        field: "finishedAt",
      },
      duration: "Durasi Penyelesaian (hari kerja)",
      isMet: "Memenuhi Standar ≤ 2 Hari Kerja (Ya/Tidak)",
      note: "Keterangan",
    },
  },
};
