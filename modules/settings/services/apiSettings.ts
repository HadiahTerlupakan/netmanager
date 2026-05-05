import { logger } from "@/lib/logger";
import { decryptApiKey, encryptApiKey } from "@/lib/utils/encryption";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";
import { SettingsRepository } from "../repositories/SettingsRepository";
import {
  testCloudflareR2Connection,
  testGoogleGeminiApiKey,
} from "./apiSettings.connection-tests";

export type {
  GeminiApiKeyTestResult,
  R2ConnectionTestPayload,
} from "./apiSettings.connection-tests";

export type ApiSettingsPayload = {
  googleGeminiApiKey: string;
  geminiEnabled: boolean;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  r2Enabled: boolean;
};

export type ApiSettingsPostPayload = Partial<ApiSettingsPayload>;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;
const SECRET_PLACEHOLDER = "********";

export const API_SETTINGS_KEYS: string[] = [
  "GOOGLE_GEMINI_API_KEY",
  "GEMINI_ENABLED",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "R2_ENABLED",
] as const;

function getSettingValue(records: SettingsEntity[], key: string): string {
  const setting = records.find((item) => item.key === key);
  if (!setting?.value) {
    return "";
  }

  if (setting.encrypted) {
    try {
      return decryptApiKey(setting.value);
    } catch (error) {
      logger.error(
        `[apiSettings] Failed to decrypt setting key: ${key}`,
        error,
      );
      return SECRET_PLACEHOLDER;
    }
  }

  return setting.value;
}

/** Maps settings entities into API settings payload. */
export function mapApiSettingsResponse(
  records: SettingsEntity[],
): ApiSettingsPayload {
  const settingsMap = new Map(
    records.map((setting) => [setting.key, setting.value]),
  );

  return {
    googleGeminiApiKey: settingsMap.get("GOOGLE_GEMINI_API_KEY") || "",
    geminiEnabled: settingsMap.get("GEMINI_ENABLED") === "true",
    r2AccountId: settingsMap.get("R2_ACCOUNT_ID") || "",
    r2AccessKeyId: settingsMap.get("R2_ACCESS_KEY_ID") || "",
    r2SecretAccessKey: getSettingValue(records, "R2_SECRET_ACCESS_KEY"),
    r2BucketName: settingsMap.get("R2_BUCKET_NAME") || "",
    r2PublicUrl: settingsMap.get("R2_PUBLIC_URL") || "",
    r2Enabled: settingsMap.get("R2_ENABLED") === "true",
  };
}

/** Builds repository upserts for API settings payload. */
export function buildApiSettingsUpserts(
  payload: ApiSettingsPostPayload,
): SettingsUpsertEntity[] {
  const upserts: SettingsUpsertEntity[] = [];

  if (payload.googleGeminiApiKey !== undefined) {
    upserts.push({
      key: "GOOGLE_GEMINI_API_KEY",
      value: payload.googleGeminiApiKey?.trim() || null,
      description: "Google Gemini API Key untuk OCR KTP",
    });
  }

  if (payload.geminiEnabled !== undefined) {
    upserts.push({
      key: "GEMINI_ENABLED",
      value: payload.geminiEnabled ? "true" : "false",
      description: "Enable Google Gemini API for OCR",
    });
  }

  if (payload.r2AccountId !== undefined) {
    upserts.push({
      key: "R2_ACCOUNT_ID",
      value: payload.r2AccountId?.trim() || null,
      description: "Cloudflare Account ID",
    });
  }

  if (payload.r2AccessKeyId !== undefined) {
    upserts.push({
      key: "R2_ACCESS_KEY_ID",
      value: payload.r2AccessKeyId?.trim() || null,
      description: "Cloudflare R2 Access Key ID",
    });
  }

  if (payload.r2SecretAccessKey !== undefined) {
    const secretValue = payload.r2SecretAccessKey?.trim() || "";
    if (secretValue !== SECRET_PLACEHOLDER) {
      upserts.push({
        key: "R2_SECRET_ACCESS_KEY",
        value: secretValue ? encryptApiKey(secretValue) : null,
        description: "Cloudflare R2 Secret Access Key",
        encrypted: true,
      });
    }
  }

  if (payload.r2BucketName !== undefined) {
    upserts.push({
      key: "R2_BUCKET_NAME",
      value: payload.r2BucketName?.trim() || null,
      description: "Cloudflare R2 Bucket Name",
    });
  }

  if (payload.r2PublicUrl !== undefined) {
    upserts.push({
      key: "R2_PUBLIC_URL",
      value: payload.r2PublicUrl?.trim() || null,
      description: "Cloudflare R2 Public URL (custom domain atau R2.dev)",
    });
  }

  if (payload.r2Enabled !== undefined) {
    upserts.push({
      key: "R2_ENABLED",
      value: payload.r2Enabled ? "true" : "false",
      description: "Enable Cloudflare R2 Storage",
    });
  }

  return upserts;
}

/** Gets tenant-scoped API settings. */
export async function getApiSettings(
  tenantId: string,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<ApiSettingsPayload> {
  const records = await repository.findManyByKeys(API_SETTINGS_KEYS, tenantId);
  return mapApiSettingsResponse(records);
}

/** Updates tenant-scoped API settings. */
export async function updateApiSettings(
  tenantId: string,
  payload: ApiSettingsPostPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  const updates = buildApiSettingsUpserts(payload);
  if (!updates.length) {
    return;
  }

  await repository.upsertMany(updates.map((entry) => ({ ...entry, tenantId })));
}

export { testCloudflareR2Connection, testGoogleGeminiApiKey };
