import { logger } from "@/lib/logger";
import axios from "axios";
import { logActivitySafe } from "@/lib/logger";
import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

const ACS_SETTINGS_KEYS = [
  "ACS_GENIEACS_URL",
  "ACS_APP_NAME",
  "ACS_VP_PPPOE_USERNAME",
  "ACS_VP_RX_POWER",
  "ACS_VP_ACTIVE_DEVICES",
  "ACS_VP_WAN_BRIDGE",
  "ACS_VP_TEMPERATURE",
  "ACS_VP_SUPER_ADMIN",
  "ACS_VP_SUPER_PASSWORD",
  "ACS_VP_USER_ADMIN",
  "ACS_VP_USER_PASSWORD",
  "ACS_RX_POWER_EXCELLENT",
  "ACS_RX_POWER_FAIR",
  "ACS_DEVICE_DATA_INTERVAL",
  "ACS_MAPPING_DATA_INTERVAL",
  "ACS_DASHBOARD_DATA_INTERVAL",
  "ACS_DEVICE_STATUS_INTERVAL",
  "ACS_DEVICE_ONLINE_THRESHOLD",
  "ACS_PORTAL_API_KEY",
  "ACS_TELEGRAM_BOT_TOKEN",
  "ACS_TELEGRAM_CHAT_IDS",
  "ACS_TELEGRAM_BOT_ENABLED",
] as const;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

export type AcsSettingsPayload = {
  genieAcsUrl: string;
  appName: string;
  vpPppoeUsername: string;
  vpRxPower: string;
  vpActiveDevices: string;
  vpWanBridge: string;
  vpTemperature: string;
  vpSuperAdmin: string;
  vpSuperPassword: string;
  vpUserAdmin: string;
  vpUserPassword: string;
  rxPowerExcellent: number;
  rxPowerFair: number;
  deviceDataInterval: number;
  mappingDataInterval: number;
  dashboardDataInterval: number;
  deviceStatusInterval: number;
  deviceOnlineThreshold: number;
  portalApiKey: string;
  telegramBotToken: string;
  telegramChatIds: string;
  telegramBotEnabled: boolean;
};

function parseNumber(
  value: string | null | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Maps settings entities into ACS settings payload. */
export function mapAcsSettingsResponse(
  records: SettingsEntity[],
): AcsSettingsPayload {
  const settingsMap = new Map(
    records.map((record) => [record.key, record.value]),
  );

  return {
    // Tanpa nilai di Pengaturan, ACS dianggap belum dikonfigurasi.
    //
    // Sebelumnya di sini ada default "http://localhost:7557/devices" — alamat
    // lingkungan pengembangan yang ikut terbawa ke produksi, tempat GenieACS
    // memang tidak pernah dipasang. Akibatnya setiap permintaan menabrak
    // ECONNREFUSED dan endpoint mengembalikan 502, padahal `AcsDeviceService`
    // sudah punya penjaga "belum dikonfigurasi" yang mengembalikan pesan jelas
    // — penjaga itu tidak pernah kebagian jalan karena nilainya selalu terisi.
    genieAcsUrl: settingsMap.get("ACS_GENIEACS_URL") || "",
    appName: settingsMap.get("ACS_APP_NAME") || "SolusiDigitalNet",
    vpPppoeUsername:
      settingsMap.get("ACS_VP_PPPOE_USERNAME") ||
      "VirtualParameters.pppoeUsername2",
    vpRxPower:
      settingsMap.get("ACS_VP_RX_POWER") || "VirtualParameters.RXPower",
    vpActiveDevices:
      settingsMap.get("ACS_VP_ACTIVE_DEVICES") ||
      "VirtualParameters.activedevices",
    vpWanBridge:
      settingsMap.get("ACS_VP_WAN_BRIDGE") || "VirtualParameters.WANBridge",
    vpTemperature:
      settingsMap.get("ACS_VP_TEMPERATURE") || "VirtualParameters.gettemp",
    vpSuperAdmin:
      settingsMap.get("ACS_VP_SUPER_ADMIN") || "VirtualParameters.superAdmin",
    vpSuperPassword:
      settingsMap.get("ACS_VP_SUPER_PASSWORD") ||
      "VirtualParameters.superPassword",
    vpUserAdmin:
      settingsMap.get("ACS_VP_USER_ADMIN") || "VirtualParameters.userAdmin",
    vpUserPassword:
      settingsMap.get("ACS_VP_USER_PASSWORD") ||
      "VirtualParameters.userPassword",
    rxPowerExcellent: parseNumber(
      settingsMap.get("ACS_RX_POWER_EXCELLENT"),
      -23,
    ),
    rxPowerFair: parseNumber(settingsMap.get("ACS_RX_POWER_FAIR"), -26),
    deviceDataInterval: parseNumber(
      settingsMap.get("ACS_DEVICE_DATA_INTERVAL"),
      5.5,
    ),
    mappingDataInterval: parseNumber(
      settingsMap.get("ACS_MAPPING_DATA_INTERVAL"),
      5.5,
    ),
    dashboardDataInterval: parseNumber(
      settingsMap.get("ACS_DASHBOARD_DATA_INTERVAL"),
      5.5,
    ),
    deviceStatusInterval: parseNumber(
      settingsMap.get("ACS_DEVICE_STATUS_INTERVAL"),
      0.5,
    ),
    deviceOnlineThreshold: parseNumber(
      settingsMap.get("ACS_DEVICE_ONLINE_THRESHOLD"),
      10,
    ),
    portalApiKey: settingsMap.get("ACS_PORTAL_API_KEY") || "",
    telegramBotToken: settingsMap.get("ACS_TELEGRAM_BOT_TOKEN") || "",
    telegramChatIds: settingsMap.get("ACS_TELEGRAM_CHAT_IDS") || "",
    telegramBotEnabled: settingsMap.get("ACS_TELEGRAM_BOT_ENABLED") === "true",
  };
}

/** Builds repository upserts for ACS settings payload. */
export function buildAcsSettingsUpserts(
  payload: AcsSettingsPayload,
): SettingsUpsertEntity[] {
  return [
    { key: "ACS_GENIEACS_URL", value: payload.genieAcsUrl.trim() || null },
    { key: "ACS_APP_NAME", value: payload.appName.trim() || null },
    {
      key: "ACS_VP_PPPOE_USERNAME",
      value: payload.vpPppoeUsername.trim() || null,
    },
    { key: "ACS_VP_RX_POWER", value: payload.vpRxPower.trim() || null },
    {
      key: "ACS_VP_ACTIVE_DEVICES",
      value: payload.vpActiveDevices.trim() || null,
    },
    { key: "ACS_VP_WAN_BRIDGE", value: payload.vpWanBridge.trim() || null },
    { key: "ACS_VP_TEMPERATURE", value: payload.vpTemperature.trim() || null },
    { key: "ACS_VP_SUPER_ADMIN", value: payload.vpSuperAdmin.trim() || null },
    {
      key: "ACS_VP_SUPER_PASSWORD",
      value: payload.vpSuperPassword.trim() || null,
    },
    { key: "ACS_VP_USER_ADMIN", value: payload.vpUserAdmin.trim() || null },
    {
      key: "ACS_VP_USER_PASSWORD",
      value: payload.vpUserPassword.trim() || null,
    },
    {
      key: "ACS_RX_POWER_EXCELLENT",
      value: payload.rxPowerExcellent.toString() || "-23",
    },
    {
      key: "ACS_RX_POWER_FAIR",
      value: payload.rxPowerFair.toString() || "-26",
    },
    {
      key: "ACS_DEVICE_DATA_INTERVAL",
      value: payload.deviceDataInterval.toString() || "5.5",
    },
    {
      key: "ACS_MAPPING_DATA_INTERVAL",
      value: payload.mappingDataInterval.toString() || "5.5",
    },
    {
      key: "ACS_DASHBOARD_DATA_INTERVAL",
      value: payload.dashboardDataInterval.toString() || "5.5",
    },
    {
      key: "ACS_DEVICE_STATUS_INTERVAL",
      value: payload.deviceStatusInterval.toString() || "0.5",
    },
    {
      key: "ACS_DEVICE_ONLINE_THRESHOLD",
      value: payload.deviceOnlineThreshold.toString() || "10",
    },
    { key: "ACS_PORTAL_API_KEY", value: payload.portalApiKey.trim() || null },
    {
      key: "ACS_TELEGRAM_BOT_TOKEN",
      value: payload.telegramBotToken.trim() || null,
    },
    {
      key: "ACS_TELEGRAM_CHAT_IDS",
      value: payload.telegramChatIds.trim() || null,
    },
    {
      key: "ACS_TELEGRAM_BOT_ENABLED",
      value: payload.telegramBotEnabled ? "true" : "false",
    },
  ];
}

export type AcsConnectivityTestResult = {
  reachable: boolean;
  status?: number;
  message: string;
};

export async function testAcsConnectivity(
  url: string,
): Promise<AcsConnectivityTestResult> {
  try {
    const response = await axios.get(url, {
      timeout: 5000,
      validateStatus: () => true,
    });

    return {
      reachable: true,
      status: response.status,
      message: "Koneksi ke server ACS berhasil!",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Tidak dapat menjangkau server";
    logger.error("Test ACS URL Error:", message);
    return {
      reachable: false,
      message: `Koneksi gagal: ${message}`,
    };
  }
}

/** Gets ACS settings. */
export async function getAcsSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<AcsSettingsPayload> {
  const settings = await repository.findManyByKeys(ACS_SETTINGS_KEYS);
  return mapAcsSettingsResponse(settings);
}

/** Saves ACS settings. */
export async function saveAcsSettings(
  payload: AcsSettingsPayload,
  userId?: string,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  await repository.upsertMany(buildAcsSettingsUpserts(payload));

  if (userId) {
    logActivitySafe({
      action: "UPDATE",
      subject: "ACS Settings",
      userId,
      details: { type: "ACS", updates: payload },
    });
  }
}
