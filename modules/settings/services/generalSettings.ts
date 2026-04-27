import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

export type BankAccount = {
  id?: string;
  namaBank: string;
  atasNama: string;
  noRekening: string;
};

export type GeneralSettingsPayload = {
  perusahaan: string;
  namaAplikasi: string;
  alamat: string;
  nomorHp: string;
  email: string;
  deskripsiInvoice: string;
  rekeningBank: BankAccount[];
  invoiceOtomatis: string;
  disablePerpanjanganPaket: string;
  timezone: string;
  attendanceTolerance: string;
  pppConnectionMode?: string;
  autoIsolirEnabled?: boolean;
  autoIsolirHariToleransi?: string;
  reminderOtomatis: string;
  reminderFrequency: "ONCE" | "DAILY";
  reminderTime: string;
  notifApp: boolean;
  notifWa: boolean;
  notifEmail: boolean;
};

export type PublicGeneralSettingsPayload = {
  perusahaan: string;
  alamat: string;
  nomorHp: string;
  deskripsiInvoice: string;
};

export const GENERAL_SETTINGS_KEYS: string[] = [
  "GENERAL_PERUSAHAAN",
  "GENERAL_NAMA_APLIKASI",
  "GENERAL_ALAMAT",
  "GENERAL_NOMOR_HP",
  "GENERAL_EMAIL",
  "GENERAL_DESKRIPSI_INVOICE",
  "GENERAL_REKENING_BANK",
  "GENERAL_INVOICE_OTOMATIS",
  "GENERAL_DISABLE_PERPANJANGAN_PAKET",
  "GENERAL_TIMEZONE",
  "GENERAL_ATTENDANCE_TOLERANCE",
  "PPP_CONNECTION_MODE",
  "GENERAL_AUTO_ISOLASI_ENABLED",
  "GENERAL_AUTO_ISOLASI_HARI_TOLERANSI",
  "GENERAL_REMINDER_OTOMATIS",
  "GENERAL_REMINDER_FREQUENCY",
  "GENERAL_REMINDER_TIME",
  "GENERAL_NOTIF_APP",
  "GENERAL_NOTIF_WA",
  "GENERAL_NOTIF_EMAIL",
] as const;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

/** Maps settings entities into general settings payload. */
export function mapGeneralSettingsResponse(
  records: SettingsEntity[],
): GeneralSettingsPayload {
  const settingsMap = new Map(
    records.map((setting) => [setting.key, setting.value]),
  );

  let rekeningBank: BankAccount[] = [];
  const rekeningBankStr = settingsMap.get("GENERAL_REKENING_BANK");
  if (rekeningBankStr) {
    try {
      rekeningBank = JSON.parse(rekeningBankStr);
    } catch (error) {
      console.error("Error parsing rekening bank:", error);
    }
  }

  const reminderFrequencyRaw = settingsMap.get("GENERAL_REMINDER_FREQUENCY");
  const reminderFrequency = reminderFrequencyRaw === "ONCE" ? "ONCE" : "DAILY";

  return {
    perusahaan: settingsMap.get("GENERAL_PERUSAHAAN") || "",
    namaAplikasi: settingsMap.get("GENERAL_NAMA_APLIKASI") || "NetManager",
    alamat: settingsMap.get("GENERAL_ALAMAT") || "",
    nomorHp: settingsMap.get("GENERAL_NOMOR_HP") || "",
    email: settingsMap.get("GENERAL_EMAIL") || "",
    deskripsiInvoice: settingsMap.get("GENERAL_DESKRIPSI_INVOICE") || "",
    rekeningBank,
    invoiceOtomatis: settingsMap.get("GENERAL_INVOICE_OTOMATIS") || "5",
    disablePerpanjanganPaket:
      settingsMap.get("GENERAL_DISABLE_PERPANJANGAN_PAKET") || "5",
    timezone: settingsMap.get("GENERAL_TIMEZONE") || "Asia/Jakarta",
    attendanceTolerance: settingsMap.get("GENERAL_ATTENDANCE_TOLERANCE") || "0",
    pppConnectionMode: settingsMap.get("PPP_CONNECTION_MODE") || "RADIUS",
    autoIsolirEnabled:
      settingsMap.get("GENERAL_AUTO_ISOLASI_ENABLED") !== "false",
    autoIsolirHariToleransi:
      settingsMap.get("GENERAL_AUTO_ISOLASI_HARI_TOLERANSI") || "1",
    reminderOtomatis: settingsMap.get("GENERAL_REMINDER_OTOMATIS") || "3",
    reminderFrequency,
    reminderTime: settingsMap.get("GENERAL_REMINDER_TIME") || "08:00",
    notifApp: settingsMap.get("GENERAL_NOTIF_APP") !== "false",
    notifWa: settingsMap.get("GENERAL_NOTIF_WA") === "true",
    notifEmail: settingsMap.get("GENERAL_NOTIF_EMAIL") === "true",
  };
}

/** Gets global general settings. */
export async function getGeneralSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<GeneralSettingsPayload> {
  const records = await repository.findManyByKeys(GENERAL_SETTINGS_KEYS);
  return mapGeneralSettingsResponse(records);
}

/** Updates global general settings. */
export async function updateGeneralSettings(
  payload: GeneralSettingsPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  await repository.upsertMany(buildGeneralSettingsUpserts(payload));
}

const PUBLIC_GENERAL_SETTING_KEYS = [
  "GENERAL_PERUSAHAAN",
  "GENERAL_ALAMAT",
  "GENERAL_NOMOR_HP",
  "GENERAL_DESKRIPSI_INVOICE",
] as const;

/** Gets public general settings safe for unauthenticated access. */
export async function getPublicGeneralSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<PublicGeneralSettingsPayload> {
  const records = await repository.findManyByKeys(PUBLIC_GENERAL_SETTING_KEYS);
  const settingsMap = new Map(
    records.map((record) => [record.key, record.value]),
  );

  return {
    perusahaan: settingsMap.get("GENERAL_PERUSAHAAN") || "",
    alamat: settingsMap.get("GENERAL_ALAMAT") || "",
    nomorHp: settingsMap.get("GENERAL_NOMOR_HP") || "",
    deskripsiInvoice: settingsMap.get("GENERAL_DESKRIPSI_INVOICE") || "",
  };
}

/** Builds repository upserts for general settings payload. */
export function buildGeneralSettingsUpserts(
  payload: GeneralSettingsPayload,
): SettingsUpsertEntity[] {
  return [
    {
      key: "GENERAL_PERUSAHAAN",
      value: payload.perusahaan?.trim() || null,
      description: "Nama perusahaan",
    },
    {
      key: "GENERAL_NAMA_APLIKASI",
      value: payload.namaAplikasi?.trim() || "NetManager",
      description: "Nama Aplikasi",
    },
    {
      key: "GENERAL_ALAMAT",
      value: payload.alamat?.trim() || null,
      description: "Alamat perusahaan",
    },
    {
      key: "GENERAL_NOMOR_HP",
      value: payload.nomorHp?.trim() || null,
      description: "Nomor HP perusahaan",
    },
    {
      key: "GENERAL_EMAIL",
      value: payload.email?.trim() || null,
      description: "Email perusahaan",
    },
    {
      key: "GENERAL_DESKRIPSI_INVOICE",
      value: payload.deskripsiInvoice?.trim() || null,
      description: "Deskripsi invoice",
    },
    {
      key: "GENERAL_REKENING_BANK",
      value: JSON.stringify(payload.rekeningBank || []),
      description: "Daftar rekening bank",
    },
    {
      key: "GENERAL_INVOICE_OTOMATIS",
      value: payload.invoiceOtomatis?.trim() || "5",
      description: "Jumlah hari sebelum jatuh tempo untuk invoice otomatis",
    },
    {
      key: "GENERAL_DISABLE_PERPANJANGAN_PAKET",
      value: payload.disablePerpanjanganPaket?.trim() || "5",
      description:
        "Jumlah hari sebelum jatuh tempo untuk disable perpanjangan paket",
    },
    {
      key: "GENERAL_TIMEZONE",
      value: payload.timezone?.trim() || "Asia/Jakarta",
      description: "Zona waktu aplikasi (IANA timezone)",
    },
    {
      key: "GENERAL_ATTENDANCE_TOLERANCE",
      value: payload.attendanceTolerance?.trim() || "0",
      description: "Toleransi keterlambatan (menit)",
    },
    {
      key: "PPP_CONNECTION_MODE",
      value: payload.pppConnectionMode || "RADIUS",
      description: "Mode koneksi PPP: RADIUS atau MIKROTIK_API",
    },
    {
      key: "GENERAL_AUTO_ISOLASI_ENABLED",
      value: payload.autoIsolirEnabled === false ? "false" : "true",
      description: "Aktifkan isolir otomatis",
    },
    {
      key: "GENERAL_AUTO_ISOLASI_HARI_TOLERANSI",
      value: payload.autoIsolirHariToleransi?.trim() || "1",
      description: "Hari toleransi sebelum isolir otomatis",
    },
    {
      key: "GENERAL_REMINDER_OTOMATIS",
      value: payload.reminderOtomatis?.trim() || "3",
      description: "Jumlah hari sebelum jatuh tempo untuk mulai kirim reminder",
    },
    {
      key: "GENERAL_REMINDER_FREQUENCY",
      value: payload.reminderFrequency || "DAILY",
      description: "Frekuensi pengiriman reminder (ONCE atau DAILY)",
    },
    {
      key: "GENERAL_REMINDER_TIME",
      value: payload.reminderTime?.trim() || "08:00",
      description: "Jam pengiriman reminder",
    },
    {
      key: "GENERAL_NOTIF_APP",
      value: payload.notifApp === false ? "false" : "true",
      description: "Toggle push notification app",
    },
    {
      key: "GENERAL_NOTIF_WA",
      value: payload.notifWa === true ? "true" : "false",
      description: "Toggle notification WhatsApp",
    },
    {
      key: "GENERAL_NOTIF_EMAIL",
      value: payload.notifEmail === true ? "true" : "false",
      description: "Toggle notification Email",
    },
  ];
}
