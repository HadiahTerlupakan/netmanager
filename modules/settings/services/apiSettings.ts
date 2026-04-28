import { logger } from "@/lib/logger";
import { testR2Connection } from "@/lib/utils/r2-client";
import { decryptApiKey, encryptApiKey } from "@/lib/utils/encryption";
import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

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

type GeminiTestSuccess = { success: true };
type GeminiTestFailure = { success: false; error: string };
export type GeminiApiKeyTestResult = GeminiTestSuccess | GeminiTestFailure;

async function fetchAvailableGeminiModels(
  apiKey: string,
): Promise<string | null> {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(listUrl);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const availableModels = (data.models ?? [])
      .filter((model) =>
        model.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((model) => model.name?.replace("models/", "") ?? "")
      .filter(Boolean);

    if (availableModels.length > 0) {
      return `\n\nModel yang tersedia untuk Key ini: ${availableModels.join(", ")}`;
    }

    return "\n\nTidak ada model yang tersedia untuk key ini (Mungkin perlu aktifkan Generative Language API).";
  } catch (error) {
    logger.error("[apiSettings] Failed to list Gemini models", error);
    return null;
  }
}

export async function testGoogleGeminiApiKey(
  apiKey: string,
): Promise<GeminiApiKeyTestResult> {
  const normalizedKey = apiKey.trim();
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(normalizedKey)}`;
  const payload = {
    contents: [
      {
        parts: [
          {
            text: "Test",
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(testUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { success: true };
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch (error) {
      logger.error(
        "[apiSettings] Unable to parse Gemini test error response",
        error,
      );
      responseBody = null;
    }

    const baseMessage = (responseBody as { error?: { message?: string } })
      ?.error?.message;
    let errorMessage = baseMessage || "API Key tidak valid";

    if (response.status === 404) {
      const modelHint = await fetchAvailableGeminiModels(normalizedKey);
      if (modelHint) {
        errorMessage += modelHint;
      }
    }

    return { success: false, error: errorMessage };
  } catch (error) {
    logger.error("[apiSettings] Failed to validate Gemini API key", error);
    return {
      success: false,
      error: "Gagal memverifikasi API Key. Silakan coba lagi.",
    };
  }
}

export type R2ConnectionTestPayload = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
};

export async function testCloudflareR2Connection(
  payload: R2ConnectionTestPayload,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { success, error } = await testR2Connection({
      accountId: payload.accountId.trim(),
      accessKeyId: payload.accessKeyId.trim(),
      secretAccessKey: payload.secretAccessKey.trim(),
      bucketName: payload.bucketName.trim(),
      publicUrl: payload.publicUrl ?? "",
    });

    if (success) {
      return { success: true };
    }

    return { success: false, error: error ?? "Koneksi gagal" };
  } catch (error) {
    logger.error("[apiSettings] R2 connection test failed", error);
    return { success: false, error: "Koneksi gagal" };
  }
}
