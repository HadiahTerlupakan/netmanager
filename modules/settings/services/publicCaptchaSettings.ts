import { SettingsRepository } from "../repositories/SettingsRepository";
import type { SettingsEntity } from "../domain/entities/Settings";
import type { ISettingsRepository } from "../domain/ports/ISettingsRepository";

const PUBLIC_CAPTCHA_KEYS = ["captcha_enabled", "captcha_site_key"] as const;
const defaultSettingsRepository: ISettingsRepository = SettingsRepository;

export type PublicCaptchaSettings = {
  enabled: boolean;
  siteKey: string;
};

/** Returns public captcha config without exposing secret keys. */
export async function getPublicCaptchaSettings(
  repository: ISettingsRepository = defaultSettingsRepository,
): Promise<PublicCaptchaSettings> {
  const settings = await repository.findManyByKeys(PUBLIC_CAPTCHA_KEYS);
  return mapPublicCaptchaSettings(settings);
}

/** Maps public captcha settings without secret keys. */
export function mapPublicCaptchaSettings(
  settings: SettingsEntity[],
): PublicCaptchaSettings {
  const enabled = findSettingValue(settings, "captcha_enabled") === "true";
  const siteKey = findSettingValue(settings, "captcha_site_key") ?? "";

  return {
    enabled,
    siteKey: enabled ? siteKey : "",
  };
}

function findSettingValue(settings: SettingsEntity[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}
