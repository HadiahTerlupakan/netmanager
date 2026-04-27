import { decryptApiKey, encryptApiKey } from "@/lib/utils/encryption";
import { SettingsRepository } from "../repositories/SettingsRepository";
import type {
  SettingsEntity,
  SettingsUpsertEntity,
} from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

export type CaptchaSettingsPayload = {
  enabled: boolean;
  siteKey: string;
  secretKey: string;
};

const CAPTCHA_SETTINGS_KEYS = [
  "captcha_enabled",
  "captcha_site_key",
  "captcha_secret_key",
] as const;

const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

/** Maps settings entities into captcha settings payload. */
export function mapCaptchaSettingsResponse(
  records: SettingsEntity[],
): CaptchaSettingsPayload {
  const settingsMap = new Map(
    records.map((record) => [record.key, record.value]),
  );
  const secretRecord = records.find(
    (record) => record.key === "captcha_secret_key",
  );

  let secretKey = secretRecord?.value || "";
  if (secretRecord?.value && secretRecord.encrypted) {
    secretKey = decryptApiKey(secretRecord.value);
  }

  return {
    enabled: settingsMap.get("captcha_enabled") === "true",
    siteKey: settingsMap.get("captcha_site_key") || "",
    secretKey,
  };
}

/** Builds repository upserts for captcha settings payload. */
export function buildCaptchaSettingsUpserts(
  payload: CaptchaSettingsPayload,
): SettingsUpsertEntity[] {
  const normalizedSecretKey = payload.secretKey.trim();
  const encryptedSecretKey = normalizedSecretKey
    ? encryptApiKey(normalizedSecretKey)
    : null;

  return [
    {
      key: "captcha_enabled",
      value: String(payload.enabled),
      description: "Enable/Disable Cloudflare Turnstile",
      encrypted: false,
    },
    {
      key: "captcha_site_key",
      value: payload.siteKey.trim(),
      description: "Cloudflare Turnstile Site Key",
      encrypted: false,
    },
    {
      key: "captcha_secret_key",
      value: encryptedSecretKey,
      description: "Cloudflare Turnstile Secret Key",
      encrypted: Boolean(encryptedSecretKey),
    },
  ];
}

/** Gets captcha settings including decrypted secret key. */
export async function getCaptchaSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<CaptchaSettingsPayload> {
  const records = await repository.findManyByKeys(CAPTCHA_SETTINGS_KEYS);
  return mapCaptchaSettingsResponse(records);
}

/** Saves captcha settings. */
export async function saveCaptchaSettings(
  payload: CaptchaSettingsPayload,
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<void> {
  await repository.upsertMany(buildCaptchaSettingsUpserts(payload));
}
