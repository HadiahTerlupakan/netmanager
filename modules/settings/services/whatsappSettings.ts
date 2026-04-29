import { encryptApiKey } from "@/lib/utils/encryption";
import { logger } from "@/lib/logger";
import { WhatsAppService } from "@/modules/notification";
import type { SettingsUpsertEntity } from "../domain/entities/Settings";
import { getTenantSettingsMap, upsertTenantSettings } from "./tenantSettings";
import type { TenantSettingsMap } from "./tenantSettings";

const SUPPORTED_WHATSAPP_PROVIDERS = ["WABLAS", "FONNTE", "MPWA"] as const;

type SupportedWhatsAppProvider = (typeof SUPPORTED_WHATSAPP_PROVIDERS)[number];

export type WhatsAppSettingsPayload = {
  whatsappProvider: string;
  whatsappApiKey: string;
  whatsappDomain: string;
  whatsappDeviceId: string;
};

export type WhatsAppSettingsUpdatePayload = Partial<WhatsAppSettingsPayload>;

export type WhatsAppTestResult = {
  success: boolean;
  message: string;
  source: "provider" | "system";
};

export const WHATSAPP_SETTINGS_FIELDS = [
  { key: "WHATSAPP_PROVIDER", defaultValue: "WABLAS" },
  { key: "WHATSAPP_API_KEY", defaultValue: "", decryptValue: true },
  { key: "WABLAS_DOMAIN", defaultValue: "" },
  { key: "WABLAS_DEVICE_ID", defaultValue: "" },
] as const;

function sanitizeString(value?: string): string {
  return value?.trim() ?? "";
}

function mapToPayload(settingsMap: TenantSettingsMap): WhatsAppSettingsPayload {
  return {
    whatsappProvider: normalizeProvider(settingsMap["WHATSAPP_PROVIDER"]),
    whatsappApiKey: settingsMap["WHATSAPP_API_KEY"] || "",
    whatsappDomain: settingsMap["WABLAS_DOMAIN"] || "",
    whatsappDeviceId: settingsMap["WABLAS_DEVICE_ID"] || "",
  };
}

function normalizeProvider(provider?: string): SupportedWhatsAppProvider {
  return SUPPORTED_WHATSAPP_PROVIDERS.includes(
    provider as SupportedWhatsAppProvider,
  )
    ? (provider as SupportedWhatsAppProvider)
    : "WABLAS";
}

function buildUpsertEntries(
  payload: WhatsAppSettingsUpdatePayload,
): SettingsUpsertEntity[] {
  const entries: SettingsUpsertEntity[] = [];

  if (payload.whatsappProvider !== undefined) {
    entries.push({
      key: "WHATSAPP_PROVIDER",
      value: normalizeProvider(payload.whatsappProvider),
      description: "WhatsApp configuration: WHATSAPP_PROVIDER",
    });
  }

  if (payload.whatsappApiKey !== undefined) {
    const apiKeyValue = sanitizeString(payload.whatsappApiKey);
    entries.push({
      key: "WHATSAPP_API_KEY",
      value: apiKeyValue ? encryptApiKey(apiKeyValue) : "",
      encrypted: !!apiKeyValue,
      description: "WhatsApp configuration: WHATSAPP_API_KEY",
    });
  }

  if (payload.whatsappDeviceId !== undefined) {
    entries.push({
      key: "WABLAS_DEVICE_ID",
      value: sanitizeString(payload.whatsappDeviceId),
      description: "WhatsApp configuration: WABLAS_DEVICE_ID",
    });
  }

  if (payload.whatsappDomain !== undefined) {
    entries.push({
      key: "WABLAS_DOMAIN",
      value: sanitizeString(payload.whatsappDomain),
      description: "WhatsApp configuration: WABLAS_DOMAIN",
    });
  }

  return entries;
}

export async function getWhatsAppSettings(
  tenantId: string,
): Promise<WhatsAppSettingsPayload> {
  const settingsMap = await getTenantSettingsMap(
    tenantId,
    WHATSAPP_SETTINGS_FIELDS,
  );
  return mapToPayload(settingsMap);
}

export async function updateWhatsAppSettings(
  tenantId: string,
  payload: WhatsAppSettingsUpdatePayload,
): Promise<void> {
  const entries = buildUpsertEntries(payload);
  if (!entries.length) {
    return;
  }

  await upsertTenantSettings(tenantId, entries);
}

export async function testWhatsAppSettings(
  tenantId: string,
  phone: string,
): Promise<WhatsAppTestResult> {
  const whatsappService = new WhatsAppService(undefined, () =>
    getTenantSettingsMap(tenantId, WHATSAPP_SETTINGS_FIELDS),
  );

  try {
    const result = await whatsappService.testConnection(phone);
    const message = result.success
      ? "Pesan percobaan berhasil dikirim"
      : result.error || "Gagal mengirim pesan percobaan WhatsApp";

    return {
      success: Boolean(result.success),
      message,
      source: "provider",
    };
  } catch (error) {
    logger.error(
      "[WhatsApp Test] Failed to execute WhatsApp test",
      error as Error,
      { phone },
    );
    return {
      success: false,
      message: "Gagal menjalankan tes WhatsApp",
      source: "system",
    };
  }
}
