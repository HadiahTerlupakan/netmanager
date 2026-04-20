export const DEFAULT_PUBLIC_APP_NAME = "NetManager";
export const DEFAULT_PUBLIC_APP_LOGO_URL = "/images/logo-sbl.png";

type PublicLogoResolutionInput = {
  brandingLogoUrl?: string | null;
  settingsLogoUrl?: string | null;
  isBrandingLoading: boolean;
  isSettingsLoading: boolean;
};

function normalizeBrandingValue(value?: string | null): string | null {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
}

export function resolveSidebarLogoUrl({
  brandingLogoUrl,
  settingsLogoUrl,
  isBrandingLoading,
  isSettingsLoading,
}: PublicLogoResolutionInput): string | null {
  const resolvedBrandingLogoUrl = normalizeBrandingValue(brandingLogoUrl);
  if (resolvedBrandingLogoUrl) {
    return resolvedBrandingLogoUrl;
  }

  const resolvedSettingsLogoUrl = normalizeBrandingValue(settingsLogoUrl);
  if (resolvedSettingsLogoUrl) {
    return resolvedSettingsLogoUrl;
  }

  if (isBrandingLoading || isSettingsLoading) {
    return null;
  }

  return DEFAULT_PUBLIC_APP_LOGO_URL;
}
