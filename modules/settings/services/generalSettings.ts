import { logger } from "@/lib/logger";
import { getTenantIdFromContext } from "@/lib/tenant-context";
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

/**
 * Single source of truth untuk mapping setiap field payload ke record Settings.
 * Read (GENERAL_SETTINGS_KEYS) dan write (buildGeneralSettingsUpserts) sama-sama
 * diturunkan dari tabel ini agar tidak pernah drift — mismatch key read/write
 * adalah akar bug tenant-scope yang pernah terjadi sebelumnya.
 */
type GeneralSettingDefinition = {
  key: string;
  description: string;
  resolveValue: (payload: GeneralSettingsPayload) => string | null;
};

const GENERAL_SETTINGS_DEFINITIONS: GeneralSettingDefinition[] = [
  {
    key: "GENERAL_PERUSAHAAN",
    description: "Nama perusahaan",
    resolveValue: (p) => p.perusahaan?.trim() || null,
  },
  {
    key: "GENERAL_NAMA_APLIKASI",
    description: "Nama Aplikasi",
    resolveValue: (p) => p.namaAplikasi?.trim() || "NetManager",
  },
  {
    key: "GENERAL_ALAMAT",
    description: "Alamat perusahaan",
    resolveValue: (p) => p.alamat?.trim() || null,
  },
  {
    key: "GENERAL_NOMOR_HP",
    description: "Nomor HP perusahaan",
    resolveValue: (p) => p.nomorHp?.trim() || null,
  },
  {
    key: "GENERAL_EMAIL",
    description: "Email perusahaan",
    resolveValue: (p) => p.email?.trim() || null,
  },
  {
    key: "GENERAL_DESKRIPSI_INVOICE",
    description: "Deskripsi invoice",
    resolveValue: (p) => p.deskripsiInvoice?.trim() || null,
  },
  {
    key: "GENERAL_REKENING_BANK",
    description: "Daftar rekening bank",
    resolveValue: (p) => JSON.stringify(p.rekeningBank || []),
  },
  {
    key: "GENERAL_INVOICE_OTOMATIS",
    description: "Jumlah hari sebelum jatuh tempo untuk invoice otomatis",
    resolveValue: (p) => p.invoiceOtomatis?.trim() || "5",
  },
  {
    key: "GENERAL_DISABLE_PERPANJANGAN_PAKET",
    description:
      "Jumlah hari sebelum jatuh tempo untuk disable perpanjangan paket",
    resolveValue: (p) => p.disablePerpanjanganPaket?.trim() || "5",
  },
  {
    key: "GENERAL_TIMEZONE",
    description: "Zona waktu aplikasi (IANA timezone)",
    resolveValue: (p) => p.timezone?.trim() || "Asia/Jakarta",
  },
  {
    key: "GENERAL_ATTENDANCE_TOLERANCE",
    description: "Toleransi keterlambatan (menit)",
    resolveValue: (p) => p.attendanceTolerance?.trim() || "0",
  },
  {
    key: "PPP_CONNECTION_MODE",
    description: "Mode koneksi PPP: RADIUS atau MIKROTIK_API",
    resolveValue: (p) => p.pppConnectionMode || "RADIUS",
  },
  {
    key: "GENERAL_AUTO_ISOLASI_ENABLED",
    description: "Aktifkan isolir otomatis",
    resolveValue: (p) => (p.autoIsolirEnabled === false ? "false" : "true"),
  },
  {
    key: "GENERAL_AUTO_ISOLASI_HARI_TOLERANSI",
    description: "Hari toleransi sebelum isolir otomatis",
    resolveValue: (p) => p.autoIsolirHariToleransi?.trim() || "1",
  },
  {
    key: "GENERAL_REMINDER_OTOMATIS",
    description: "Jumlah hari sebelum jatuh tempo untuk mulai kirim reminder",
    resolveValue: (p) => p.reminderOtomatis?.trim() || "3",
  },
  {
    key: "GENERAL_REMINDER_FREQUENCY",
    description: "Frekuensi pengiriman reminder (ONCE atau DAILY)",
    resolveValue: (p) => p.reminderFrequency || "DAILY",
  },
  {
    key: "GENERAL_REMINDER_TIME",
    description: "Jam pengiriman reminder",
    resolveValue: (p) => p.reminderTime?.trim() || "08:00",
  },
  {
    key: "GENERAL_NOTIF_APP",
    description: "Toggle push notification app",
    resolveValue: (p) => (p.notifApp === false ? "false" : "true"),
  },
  {
    key: "GENERAL_NOTIF_WA",
    description: "Toggle notification WhatsApp",
    resolveValue: (p) => (p.notifWa === true ? "true" : "false"),
  },
  {
    key: "GENERAL_NOTIF_EMAIL",
    description: "Toggle notification Email",
    resolveValue: (p) => (p.notifEmail === true ? "true" : "false"),
  },
];

export const GENERAL_SETTINGS_KEYS: string[] = GENERAL_SETTINGS_DEFINITIONS.map(
  (definition) => definition.key,
);

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
      logger.error("Error parsing rekening bank:", error);
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

async function resolveActiveTenantId(
  tenantId?: string | null,
): Promise<string | null> {
  if (tenantId !== undefined) {
    return tenantId;
  }

  const tenantContext = await getTenantIdFromContext();
  return tenantContext.tenantId ?? null;
}

/** Gets tenant-scoped general settings. */
export async function getGeneralSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
  tenantId?: string | null,
): Promise<GeneralSettingsPayload> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  const records = await repository.findManyByKeys(
    GENERAL_SETTINGS_KEYS,
    activeTenantId,
  );
  return mapGeneralSettingsResponse(records);
}

/** Gets auto-isolation scheduler settings in normalized form. */
export async function getAutoIsolationSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
  tenantId?: string | null,
): Promise<{ enabled: boolean; toleranceDays: number }> {
  const settings = await getGeneralSettings(repository, tenantId);
  const toleranceDays = Number.parseInt(
    settings.autoIsolirHariToleransi ?? "1",
    10,
  );

  return {
    enabled: settings.autoIsolirEnabled !== false,
    toleranceDays: Number.isNaN(toleranceDays) ? 1 : Math.max(toleranceDays, 0),
  };
}

/** Updates tenant-scoped general settings. */
export async function updateGeneralSettings(
  payload: GeneralSettingsPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
  tenantId?: string | null,
): Promise<void> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  await repository.upsertMany(
    buildGeneralSettingsUpserts(payload, activeTenantId),
  );
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
  tenantId?: string | null,
): Promise<PublicGeneralSettingsPayload> {
  const activeTenantId = await resolveActiveTenantId(tenantId);
  const records = await repository.findManyByKeys(
    PUBLIC_GENERAL_SETTING_KEYS,
    activeTenantId,
  );
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
  tenantId?: string | null,
): SettingsUpsertEntity[] {
  const scopedTenantId = tenantId ?? null;
  return GENERAL_SETTINGS_DEFINITIONS.map((definition) => ({
    key: definition.key,
    value: definition.resolveValue(payload),
    description: definition.description,
    tenantId: scopedTenantId,
  }));
}
