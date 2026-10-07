/**
 * Katalog parameter Self-Assessment Komdigi per jenis izin.
 *
 * Komdigi menerbitkan dua formulir berbeda, dan perbedaannya bukan sekadar
 * judul: daftar parameter, tolok ukur, bahkan acuan peraturannya berlainan.
 * Yang paling mudah luput — "pasang baru" ada di keduanya dengan tolok ukur
 * berbeda (Jartaplok ≥ 90%, ISP ≥ 95%), dan "pemulihan layanan" hanya ada di
 * Jartaplok. Katalog ini jadi satu-satunya tempat perbedaan itu dinyatakan.
 *
 * Sumber: draf resmi `Draft Self Assessment Jartaplok-PS.docx`,
 * `Draft Self Assessment Layanan Akses Internet (ISP).docx`, dan rumus pada
 * `Panduan Pelaporan QoS ISP.pdf`.
 */

export const LICENSE_SCHEMES = ["JARTAPLOK_PS", "ISP"] as const;
export type LicenseScheme = (typeof LICENSE_SCHEMES)[number];

export const PERDIRJEN_7_2024 = "Perdirjen 7 Tahun 2024";
export const PERDIRJEN_1_2021 = "Perdirjen 1 tahun 2021";

/** Cara sistem menghitung capaian sebuah parameter. */
export type AutoComputation =
  /** Permohonan selesai dalam batas waktu ÷ seluruh permohonan (work order). */
  | {
      kind: "WORK_ORDER_DURATION";
      workOrder: "PASANG_BARU" | "PEMULIHAN_LAYANAN";
      maxDays: number;
      dayUnit: "CALENDAR" | "WORKING";
    }
  /** Tiket kategori tertentu ÷ jumlah tagihan pada periode. */
  | { kind: "TICKET_PER_INVOICE"; categories: TicketCategoryKey[] }
  /** Tiket kategori tertentu ÷ jumlah pelanggan pada periode. */
  | { kind: "TICKET_PER_CUSTOMER"; categories: TicketCategoryKey[] }
  /** Tiket terselesaikan ÷ tiket diterima, pada kategori tertentu. */
  | { kind: "TICKET_RESOLVED"; categories: TicketCategoryKey[] }
  /** Tiket terselesaikan dalam batas hari ÷ seluruh tiket terselesaikan. */
  | {
      kind: "TICKET_RESOLVED_WITHIN";
      categories: TicketCategoryKey[];
      maxDays: number;
      dayUnit: "CALENDAR" | "WORKING";
    };

export type TicketCategoryKey = "TECHNICAL" | "BILLING" | "ACCOUNT" | "OTHER";

/** Arah tolok ukur: capaian minimal (≥) atau batas maksimal (≤). */
export type TargetDirection = "MIN" | "MAX";

export interface ParameterSpec {
  /** Unik dalam satu skema; dipakai sebagai kunci isian manual & link dokumen. */
  key: string;
  /**
   * Nama penanda `{...}` di berkas template Word. Ditulis eksplisit, bukan
   * diturunkan dari `key`: template Jartaplok yang sudah dipakai memakai nama
   * Indonesia (`pasang_baru`, `pemulihan`) yang tidak bisa dihasilkan transformasi
   * mekanis, dan mengubahnya berarti template lama berhenti terisi.
   */
  placeholder: string;
  standard: string;
  title: string;
  basis: string;
  targetRatio: number;
  targetDirection: TargetDirection;
  /** Teks tolok ukur sebagaimana tercetak di formulir, mis. "≥ 95%". */
  targetLabel: string;
  /**
   * `undefined` berarti nilainya diketik manual — parameter jaringan menuntut
   * uji lapangan (kondisi bergerak & diam, jam sibuk per jenis lokasi) yang
   * tidak mungkin diturunkan dari data operasional.
   */
  auto?: AutoComputation;
}

export interface ParameterBlock {
  key: string;
  /** Kosong bila formulir tidak memecah blok (Jartaplok PS). */
  label: string;
  network: ParameterSpec[];
  nonNetwork: ParameterSpec[];
}

export interface SchemeCatalog {
  scheme: LicenseScheme;
  label: string;
  /** Nilai bawaan kolom "Jenis Izin Penyelenggaraan" pada dokumen. */
  licenseTypeLabel: string;
  documentTitle: string;
  templateFile: string;
  blocks: ParameterBlock[];
}

const PASANG_BARU_KOLOM = {
  reference: "Daftar Pemohon Pasang Baru yang Disetujui",
  firstTime: "Tanggal & Waktu Pengajuan (dd/mm/yyyy hh:mm:ss)",
  secondTime: "Tanggal & Waktu Persetujuan (dd/mm/yyyy hh:mm:ss)",
} as const;

// ---------------------------------------------------------------------------
// Jartaplok PS — satu blok, 6 parameter
// ---------------------------------------------------------------------------

const JARTAPLOK_PS: SchemeCatalog = {
  scheme: "JARTAPLOK_PS",
  label: "Jartaplok PS",
  licenseTypeLabel: "Jaringan Tetap Lokal Berbasis Packet Switched",
  documentTitle:
    "PELAPORAN KINERJA JARINGAN DAN LAYANAN BERDASARKAN SELF ASSESSMENT",
  templateFile: "self-assessment-komdigi.docx",
  blocks: [
    {
      key: "UTAMA",
      label: "",
      network: [
        {
          key: "packetLoss",
          placeholder: "packet_loss",
          standard: "Layanan Internet",
          title: "Persentase packet loss (Drop Rate)",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.05,
          targetDirection: "MAX",
          targetLabel: "≤ 5 %",
        },
        {
          key: "latency",
          placeholder: "latency",
          standard: "Layanan Internet",
          title: "Persentase Network Latency ≤ 250 mdet",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
        {
          key: "availability",
          placeholder: "availability",
          standard: "Layanan Internet",
          title: "Presentase network availability",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.99,
          targetDirection: "MIN",
          targetLabel: "≥ 99%",
        },
      ],
      nonNetwork: [
        {
          key: "newInstallation",
          placeholder: "pasang_baru",
          standard: "Standar Pemenuhan Pemasangan Baru",
          title:
            "Persentase pemenuhan pasang baru yang dipenuhi dalam waktu ≤7 hari kalender sejak disetujui",
          basis: PERDIRJEN_7_2024,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
          auto: {
            kind: "WORK_ORDER_DURATION",
            workOrder: "PASANG_BARU",
            maxDays: 7,
            dayUnit: "CALENDAR",
          },
        },
        {
          key: "restoration",
          placeholder: "pemulihan",
          standard: "Standar Penyelesaian Pemulihan Layanan",
          title:
            "Presentase penyelesaian permohonan pemulihan layanan dalam waktu ≤2 hari kerja",
          basis: PERDIRJEN_7_2024,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
          auto: {
            kind: "WORK_ORDER_DURATION",
            workOrder: "PEMULIHAN_LAYANAN",
            maxDays: 2,
            dayUnit: "WORKING",
          },
        },
        {
          key: "complaints",
          placeholder: "keluhan",
          standard: "Penanganan Keluhan Pelanggan",
          title:
            "Persentase penyelesaian keluhan pelanggan dalam waktu ≤3 hari kerja",
          basis: PERDIRJEN_7_2024,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// ISP — dua blok sub-jenis media akses
// ---------------------------------------------------------------------------

/** Parameter non-jaringan yang muncul di kedua blok ISP, tolok ukurnya berbeda. */
function ispNonNetwork(
  prefix: string,
  tag: string,
  batasKeluhan: number,
  batasGangguan: number,
  /** Redaksi pasang baru berbeda antar-blok pada formulir resmi. */
  judulPasangBaru: string,
): ParameterSpec[] {
  return [
    {
      key: `${prefix}.newInstallation`,
      placeholder: `${tag}_pasang_baru`,
      standard: "Standar Pemenuhan Pemasangan Baru",
      title: judulPasangBaru,
      basis: PERDIRJEN_1_2021,
      targetRatio: 0.95,
      targetDirection: "MIN",
      targetLabel: "≥ 95%",
      auto: {
        kind: "WORK_ORDER_DURATION",
        workOrder: "PASANG_BARU",
        maxDays: 7,
        dayUnit: "CALENDAR",
      },
    },
    {
      key: `${prefix}.billingComplaints`,
      placeholder: `${tag}_tagihan`,
      standard: "Penanganan Keluhan Akurasi Tagihan",
      title:
        "Persentase keluhan atas akurasi tagihan dari jumlah seluruh tagihan bulan tersebut",
      basis: PERDIRJEN_1_2021,
      targetRatio: batasKeluhan,
      targetDirection: "MAX",
      targetLabel: `≤ ${batasKeluhan * 100} %`,
      auto: { kind: "TICKET_PER_INVOICE", categories: ["BILLING"] },
    },
    {
      key: `${prefix}.generalComplaints`,
      placeholder: `${tag}_keluhan_umum`,
      standard: "Penanganan Keluhan Umum Pengguna",
      title: "Persentase keluhan umum pengguna yang diselesaikan",
      basis: PERDIRJEN_1_2021,
      targetRatio: 0.95,
      targetDirection: "MIN",
      targetLabel: "≥ 95%",
      auto: { kind: "TICKET_RESOLVED", categories: ["ACCOUNT", "OTHER"] },
    },
    {
      key: `${prefix}.disruptionReports`,
      placeholder: `${tag}_gangguan`,
      standard: "Tingkat Laporan Gangguan Layanan",
      title:
        "Persentase laporan gangguan layanan dari jumlah pengguna dalam jangka waktu 12 (dua belas) bulan",
      basis: PERDIRJEN_1_2021,
      targetRatio: batasGangguan,
      targetDirection: "MAX",
      targetLabel: `≤ ${batasGangguan * 100} %`,
      auto: { kind: "TICKET_PER_CUSTOMER", categories: ["TECHNICAL"] },
    },
    {
      key: `${prefix}.callAnswerSpeed`,
      placeholder: `${tag}_jawab_panggilan`,
      standard: "Kecepatan Jawab Kontak layanan informasi",
      title:
        "Persentase kecepatan jawab kontak layanan informasi terhadap panggilan pengguna dalam waktu 30 (tiga puluh) detik",
      basis: PERDIRJEN_1_2021,
      targetRatio: 0.9,
      targetDirection: "MIN",
      targetLabel: "≥ 90%",
    },
    {
      key: `${prefix}.emailAnswerSpeed`,
      placeholder: `${tag}_jawab_email`,
      standard: "Kecepatan Jawab Kontak layanan informasi",
      title:
        "Persentase Kecepatan Jawab Kontak Layanan Informasi terhadap email pengguna dalam waktu 3x24 jam",
      basis: PERDIRJEN_1_2021,
      targetRatio: 0.9,
      targetDirection: "MIN",
      targetLabel: "≥ 90%",
    },
  ];
}

const ISP: SchemeCatalog = {
  scheme: "ISP",
  label: "ISP",
  licenseTypeLabel: "Internet Service Provider",
  documentTitle: "PELAPORAN KINERJA LAYANAN BERDASARKAN SELF ASSESSMENT",
  templateFile: "self-assessment-isp.docx",
  blocks: [
    {
      key: "SELULER",
      label: "ISP Menggunakan Media Akses Jaringan Bergerak Seluler",
      network: [
        {
          key: "seluler.packetLoss",
          placeholder: "seluler_packet_loss",
          standard: "Layanan Internet",
          title: "Persentase packet loss (Drop Rate)",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.05,
          targetDirection: "MAX",
          targetLabel: "≤ 5 %",
        },
        {
          key: "seluler.latency",
          placeholder: "seluler_latency",
          standard: "Layanan Internet",
          title: "Persentase Network Latency ≤ 250 mdet",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
        {
          key: "seluler.downloadRate",
          placeholder: "seluler_download",
          standard: "Layanan Internet",
          title: "Persentase Download Successful Rate",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.8,
          targetDirection: "MIN",
          targetLabel: "≥ 80%",
        },
        {
          key: "seluler.uploadRate",
          placeholder: "seluler_upload",
          standard: "Layanan Internet",
          title: "Persentase Upload Successful Rate",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.75,
          targetDirection: "MIN",
          targetLabel: "≥ 75%",
        },
      ],
      nonNetwork: [
        ...ispNonNetwork(
          "seluler",
          "seluler",
          0.02,
          0.02,
          "Persentase pemenuhan pasang baru yang dipenuhi dalam waktu ≤7 hari kalender sejak disetujui",
        ).slice(0, 2),
        {
          key: "seluler.postpaidComplaintResolution",
          placeholder: "seluler_tagihan_pascabayar",
          standard: "Penanganan Keluhan Akurasi Tagihan",
          title:
            "Persentase penyelesaian keluhan atas akurasi tagihan pascabayar yang diselesaikan dalam 15 (lima belas) hari kerja",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
          auto: {
            kind: "TICKET_RESOLVED_WITHIN",
            categories: ["BILLING"],
            maxDays: 15,
            dayUnit: "WORKING",
          },
        },
        {
          key: "seluler.prepaidDepositResolution",
          placeholder: "seluler_deposit",
          standard: "Penanganan Keluhan Akurasi Tagihan",
          title:
            "Persentase penyelesaian keluhan atas akurasi pemotongan Deposit Prabayar yang diselesaikan dalam 15 (lima belas) hari kerja",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
        ...ispNonNetwork(
          "seluler",
          "seluler",
          0.02,
          0.02,
          "Persentase pemenuhan pasang baru yang dipenuhi dalam waktu ≤7 hari kalender sejak disetujui",
        ).slice(2),
        {
          key: "seluler.dataActivation",
          placeholder: "seluler_aktivasi",
          standard: "Standar Pemenuhan Aktivasi Paket Data",
          title:
            "Persentase pemenuhan permohonan aktivasi paket data dalam waktu 15 (lima belas) menit",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
      ],
    },
    {
      key: "JARTAPLOK_PS",
      label:
        "ISP Menggunakan Media Akses Jaringan Tetap Lokal (Packet Switched)",
      network: [
        {
          key: "jartaplok.packetLoss",
          placeholder: "jartaplok_packet_loss",
          standard: "Layanan Internet",
          title: "Persentase packet loss (Drop Rate)",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.05,
          targetDirection: "MAX",
          targetLabel: "≤ 5 %",
        },
        {
          key: "jartaplok.latency",
          placeholder: "jartaplok_latency",
          standard: "Layanan Internet",
          title: "Persentase Network Latency ≤ 250 mdet",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.9,
          targetDirection: "MIN",
          targetLabel: "≥ 90%",
        },
        {
          key: "jartaplok.availability",
          placeholder: "jartaplok_availability",
          standard: "Layanan Internet",
          title: "Presentase network availability",
          basis: PERDIRJEN_1_2021,
          targetRatio: 0.99,
          targetDirection: "MIN",
          targetLabel: "≥ 99%",
        },
      ],
      nonNetwork: ispNonNetwork(
        "jartaplok",
        "jartaplok",
        0.05,
        0.05,
        "Persentase pemenuhan pasang baru dalam waktu 7 (tujuh) hari kalender",
      ),
    },
  ],
};

export const SCHEME_CATALOGS: Record<LicenseScheme, SchemeCatalog> = {
  JARTAPLOK_PS,
  ISP,
};

export function catalogOf(scheme: LicenseScheme): SchemeCatalog {
  return SCHEME_CATALOGS[scheme];
}

/** Seluruh parameter satu skema, berurutan sebagaimana tercetak di formulir. */
export function parametersOf(scheme: LicenseScheme): ParameterSpec[] {
  return catalogOf(scheme).blocks.flatMap((block) => [
    ...block.network,
    ...block.nonNetwork,
  ]);
}

/** Parameter yang nilainya diketik manual pada satu skema. */
export function manualParametersOf(scheme: LicenseScheme): ParameterSpec[] {
  return parametersOf(scheme).filter((parameter) => !parameter.auto);
}

/** Parameter yang dihitung sistem pada satu skema. */
export function autoParametersOf(scheme: LicenseScheme): ParameterSpec[] {
  return parametersOf(scheme).filter((parameter) => parameter.auto);
}

export { PASANG_BARU_KOLOM };
