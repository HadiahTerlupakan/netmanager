import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  findLatestR2ObjectKeyByFilename,
  getR2Settings,
  hasR2Object,
} from "@/lib/utils/r2-client";
import {
  SettingsRepository,
  type SettingsRecord,
} from "../repositories/SettingsRepository";

const BRANDING_SETTING_KEYS = [
  "GENERAL_NAMA_APLIKASI",
  "LOGO_APLIKASI",
] as const;
const DEFAULT_APP_NAME = "NetManager";

export const DEFAULT_APP_LOGO_ASSET_PATH = "/images/logo-sbl.png";

export type AppBrandingSource = "tenant" | "global" | "default";

export type AppBrandingResult = {
  appName: string;
  appLogoUrl: string;
  source: AppBrandingSource;
  tenantId: string | null;
};

export async function resolveAppBranding(): Promise<AppBrandingResult> {
  const { tenantId } = await getTenantIdFromContext();
  const [globalBrandingSettings, tenantBrandingSettings, publicR2BaseUrl] =
    await Promise.all([
      SettingsRepository.findManyByKeys(BRANDING_SETTING_KEYS),
      getTenantBrandingSettings(tenantId),
      getPublicR2BaseUrl(),
    ]);

  const globalBrandingMap = toSettingsMap(globalBrandingSettings);
  const tenantBrandingMap = toSettingsMap(tenantBrandingSettings);

  const appName =
    getSettingTextValue(tenantBrandingMap, "GENERAL_NAMA_APLIKASI") ||
    getSettingTextValue(globalBrandingMap, "GENERAL_NAMA_APLIKASI") ||
    DEFAULT_APP_NAME;

  const tenantLogoPath = await resolveAppLogoUrl(
    tenantBrandingMap.get("LOGO_APLIKASI") ?? null,
    publicR2BaseUrl,
  );
  if (tenantLogoPath) {
    return { appName, appLogoUrl: tenantLogoPath, source: "tenant", tenantId };
  }

  const globalLogoPath = await resolveAppLogoUrl(
    globalBrandingMap.get("LOGO_APLIKASI") ?? null,
    publicR2BaseUrl,
  );
  if (globalLogoPath) {
    return { appName, appLogoUrl: globalLogoPath, source: "global", tenantId };
  }

  return {
    appName,
    appLogoUrl: DEFAULT_APP_LOGO_ASSET_PATH,
    source: "default",
    tenantId,
  };
}

async function getTenantBrandingSettings(
  tenantId: string | null,
): Promise<SettingsRecord[]> {
  if (!tenantId) {
    return [];
  }

  return SettingsRepository.findManyByKeys(BRANDING_SETTING_KEYS, tenantId);
}

function toSettingsMap(records: SettingsRecord[]): Map<string, string | null> {
  return new Map(records.map((setting) => [setting.key, setting.value]));
}

function getSettingTextValue(
  settingsMap: Map<string, string | null>,
  key: string,
): string | null {
  const value = settingsMap.get(key);
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
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

async function resolveAppLogoUrl(
  path: string | null,
  publicR2BaseUrl: string | null,
): Promise<string | null> {
  const normalizedPath = normalizeLogoPath(path);
  if (!normalizedPath) {
    return null;
  }

  if (!publicR2BaseUrl || /^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const normalizedKey = normalizedPath.replace(/^\//, "");
  if (await hasR2Object(normalizedKey)) {
    return `${publicR2BaseUrl}${normalizedPath}`;
  }

  const filename = normalizedKey.split("/").pop();
  if (!filename) {
    return `${publicR2BaseUrl}${normalizedPath}`;
  }

  const latestObjectKey = await findLatestR2ObjectKeyByFilename(filename);
  if (!latestObjectKey) {
    return `${publicR2BaseUrl}${normalizedPath}`;
  }

  return `${publicR2BaseUrl}/${latestObjectKey}`;
}

async function getPublicR2BaseUrl(): Promise<string | null> {
  const publicUrl = (await getR2Settings())?.publicUrl?.trim();
  if (!publicUrl) {
    return null;
  }

  return publicUrl.replace(/\/$/, "");
}
