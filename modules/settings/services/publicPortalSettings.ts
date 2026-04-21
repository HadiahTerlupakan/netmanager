import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getR2Settings } from "@/lib/utils/r2-client";
import {
  SettingsRepository,
  type SettingsRecord,
} from "../repositories/SettingsRepository";
import { resolveAppBranding } from "./appBranding";

const PUBLIC_SETTINGS_KEYS = [
  "GENERAL_PERUSAHAAN",
  "LOGO_INVOICE",
  "LOGO_LANDING_PAGE",
] as const;

export type PublicPortalSettingsPayload = {
  namaAplikasi: string;
  perusahaan: string;
  appLogoUrl: string;
  logoInvoice: string | null;
  landingLogoUrl: string | null;
};

export async function getPublicPortalSettings(): Promise<PublicPortalSettingsPayload> {
  const { tenantId } = await getTenantIdFromContext();
  const [tenantRecords, globalRecords, branding, publicR2BaseUrl] =
    await Promise.all([
      getTenantPublicSettings(tenantId),
      SettingsRepository.findManyByKeys(PUBLIC_SETTINGS_KEYS),
      resolveAppBranding(),
      getPublicR2BaseUrl(),
    ]);
  const settingsMap = mergeSettings(tenantRecords, globalRecords);

  return {
    namaAplikasi: branding.appName,
    perusahaan: settingsMap.get("GENERAL_PERUSAHAAN") || "",
    appLogoUrl: branding.appLogoUrl,
    logoInvoice: resolvePublicLogoUrl(
      settingsMap.get("LOGO_INVOICE") || null,
      publicR2BaseUrl,
    ),
    landingLogoUrl: resolvePublicLogoUrl(
      settingsMap.get("LOGO_LANDING_PAGE") || null,
      publicR2BaseUrl,
    ),
  };
}

async function getTenantPublicSettings(
  tenantId: string | null,
): Promise<SettingsRecord[]> {
  if (!tenantId) {
    return [];
  }

  return SettingsRepository.findManyByKeys(PUBLIC_SETTINGS_KEYS, tenantId);
}

function mergeSettings(
  tenantRecords: SettingsRecord[],
  globalRecords: SettingsRecord[],
): Map<string, string | null> {
  const globalSettings = new Map(
    globalRecords.map((setting) => [setting.key, setting.value]),
  );

  for (const setting of tenantRecords) {
    globalSettings.set(setting.key, setting.value);
  }

  return globalSettings;
}

function normalizeLogoPath(path: string | null): string | null {
  if (!path) {
    return null;
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  if (trimmedPath.startsWith("/")) {
    return trimmedPath;
  }

  return `/${trimmedPath}`;
}

function resolvePublicLogoUrl(
  path: string | null,
  publicR2BaseUrl: string | null,
): string | null {
  const normalizedPath = normalizeLogoPath(path);
  if (!normalizedPath) {
    return null;
  }

  if (!publicR2BaseUrl || /^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  return `${publicR2BaseUrl}${normalizedPath}`;
}

async function getPublicR2BaseUrl(): Promise<string | null> {
  const publicUrl = (await getR2Settings())?.publicUrl?.trim();
  if (!publicUrl) {
    return null;
  }

  return publicUrl.replace(/\/$/, "");
}
