import { API_SETTINGS_ENDPOINTS, API_SETTINGS_MESSAGES } from "./constants";
import {
  SECRET_PLACEHOLDER,
  KEEP_EXISTING_SECRET_TOKEN,
} from "./secretConstants";

export interface ApiSettings {
  googleGeminiApiKey: string;
  geminiEnabled: boolean;
  r2AccountId: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
  r2BucketName: string;
  r2PublicUrl: string;
  r2Enabled: boolean;
}

export interface R2TestPayload {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
}

/**
 * Prepare settings for save - replace placeholder with keep token.
 */
function prepareSettingsForSave(settings: ApiSettings): ApiSettings {
  return {
    ...settings,
    r2SecretAccessKey:
      settings.r2SecretAccessKey === SECRET_PLACEHOLDER
        ? KEEP_EXISTING_SECRET_TOKEN
        : settings.r2SecretAccessKey,
  };
}

/**
 * Fetch API settings from server.
 */
export async function fetchApiSettings(): Promise<ApiSettings> {
  const response = await fetch(API_SETTINGS_ENDPOINTS.SETTINGS);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || API_SETTINGS_MESSAGES.ERROR.LOAD_FAILED);
  }

  const json = await response.json();
  const data = json.data || {};

  return {
    googleGeminiApiKey: data.googleGeminiApiKey || "",
    geminiEnabled: data.geminiEnabled || false,
    r2AccountId: data.r2AccountId || "",
    r2AccessKeyId: data.r2AccessKeyId || "",
    r2SecretAccessKey: data.r2SecretAccessKey || "",
    r2BucketName: data.r2BucketName || "",
    r2PublicUrl: data.r2PublicUrl || "",
    r2Enabled: data.r2Enabled || false,
  };
}

/**
 * Save API settings to server (update existing settings).
 */
export async function saveApiSettings(settings: ApiSettings): Promise<void> {
  const preparedSettings = prepareSettingsForSave(settings);

  const response = await fetch(API_SETTINGS_ENDPOINTS.SETTINGS, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preparedSettings),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || API_SETTINGS_MESSAGES.ERROR.SAVE_FAILED);
  }
}

/**
 * Create new API settings on server.
 */
export async function createApiSettings(settings: ApiSettings): Promise<void> {
  const preparedSettings = prepareSettingsForSave(settings);

  const response = await fetch(API_SETTINGS_ENDPOINTS.SETTINGS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preparedSettings),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || API_SETTINGS_MESSAGES.ERROR.SAVE_FAILED);
  }
}

/**
 * Test R2 connection with provided credentials.
 */
export async function testR2Connection(payload: R2TestPayload): Promise<void> {
  const response = await fetch(API_SETTINGS_ENDPOINTS.R2_TEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || API_SETTINGS_MESSAGES.ERROR.R2_CONNECTION_FAILED,
    );
  }
}
