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
import {
  KEEP_EXISTING_SECRET_TOKEN,
  SECRET_PLACEHOLDER,
} from "../constants/secretConstants";

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
    r2SecretAccessKey: settingsMap.get("R2_SECRET_ACCESS_KEY") || "",
    r2BucketName: settingsMap.get("R2_BUCKET_NAME") || "",
    r2PublicUrl: settingsMap.get("R2_PUBLIC_URL") || "",
    r2Enabled: settingsMap.get("R2_ENABLED") === "true",
  };
}

/**
 * Menyamarkan rahasia sebelum pengaturan dikirim ke browser.
 *
 * Sengaja TIDAK dilakukan di `mapApiSettingsResponse`: mapper itu juga dipakai
 * server-side oleh `GeminiOcrService` untuk memanggil Google, dan oleh klien
 * R2 -- menyamarkan di sana membuat OCR memanggil API dengan kunci
 * "********". Penyamaran hanya berlaku di batas respons HTTP.
 *
 * Browser tidak pernah membutuhkan nilai aslinya: form mengirim kembali
 * placeholder sebagai `KEEP_EXISTING_SECRET_TOKEN`, dan `buildApiSettingsUpserts`
 * melewati penulisan saat menerimanya. Sebelum ini rahasia dikirim utuh --
 * form memang menampilkannya sebagai titik-titik, tetapi itu hanya kosmetik:
 * nilainya tetap terbaca lewat devtools dan ikut terekam di log jaringan.
 *
 * String kosong dipertahankan apa adanya supaya UI tetap bisa membedakan
 * "belum diisi" dari "sudah diisi".
 */
export function maskApiSettingsSecrets(
  settings: ApiSettingsPayload,
): ApiSettingsPayload {
  const mask = (value: string) => (value ? SECRET_PLACEHOLDER : "");

  return {
    ...settings,
    googleGeminiApiKey: mask(settings.googleGeminiApiKey),
    r2SecretAccessKey: mask(settings.r2SecretAccessKey),
  };
}

/** Builds repository upserts for API settings payload. */
export function buildApiSettingsUpserts(
  payload: ApiSettingsPostPayload,
): SettingsUpsertEntity[] {
  const upserts: SettingsUpsertEntity[] = [];

  if (payload.googleGeminiApiKey !== undefined) {
    const geminiKey = payload.googleGeminiApiKey?.trim() || "";

    // Sama seperti R2 secret: token ini berarti "jangan diubah". Dibutuhkan
    // karena klien kini menerima placeholder, bukan kunci aslinya -- tanpa
    // penanganan ini menyimpan form akan menimpa kunci dengan "********".
    if (geminiKey !== KEEP_EXISTING_SECRET_TOKEN) {
      upserts.push({
        key: "GOOGLE_GEMINI_API_KEY",
        value: geminiKey || null,
        description: "Google Gemini API Key untuk OCR KTP",
        // Baris lama tersimpan apa adanya dan tetap terbaca karena kolom
        // `encrypted` disimpan per-baris; penyimpanan berikutnya
        // mengenkripsinya.
        encrypted: true,
      });
    }
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

    // Skip if token indicates to keep existing secret
    if (secretValue !== KEEP_EXISTING_SECRET_TOKEN) {
      upserts.push({
        key: "R2_SECRET_ACCESS_KEY",
        value: secretValue || null,
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

/** Creates new tenant-scoped API settings. */
export async function createApiSettings(
  tenantId: string,
  payload: ApiSettingsPostPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  const updates = buildApiSettingsUpserts(payload);
  if (!updates.length) {
    return;
  }

  await repository.createMany(updates.map((entry) => ({ ...entry, tenantId })));
}

/** Updates existing tenant-scoped API settings. */
export async function updateApiSettings(
  tenantId: string,
  payload: ApiSettingsPostPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  const updates = buildApiSettingsUpserts(payload);
  if (!updates.length) {
    return;
  }

  await repository.updateMany(updates.map((entry) => ({ ...entry, tenantId })));
}

export { testCloudflareR2Connection, testGoogleGeminiApiKey };
