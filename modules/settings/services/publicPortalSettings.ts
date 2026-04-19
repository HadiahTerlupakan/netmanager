import { SettingsRepository } from "../repositories/SettingsRepository";
import { resolveAppBranding } from "./appBranding";

const PUBLIC_SETTINGS_KEYS = ["GENERAL_PERUSAHAAN", "LOGO_INVOICE"] as const;

export type PublicPortalSettingsPayload = {
  namaAplikasi: string;
  perusahaan: string;
  appLogoUrl: string;
  logoInvoice: string | null;
};

export async function getPublicPortalSettings(): Promise<PublicPortalSettingsPayload> {
  const [records, branding] = await Promise.all([
    SettingsRepository.findManyByKeys(PUBLIC_SETTINGS_KEYS),
    resolveAppBranding(),
  ]);
  const settingsMap = new Map(
    records.map((setting) => [setting.key, setting.value]),
  );

  return {
    namaAplikasi: branding.appName,
    perusahaan: settingsMap.get("GENERAL_PERUSAHAAN") || "",
    appLogoUrl: branding.appLogoUrl,
    logoInvoice: settingsMap.get("LOGO_INVOICE") || null,
  };
}
