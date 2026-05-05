import type { IRouterAccessRepository } from "../domain/ports/IRouterAccessRepository";
import type { NetworkRepository } from "../repositories/NetworkRepository";

const DEFAULT_RADIUS_AUTH_PORT = 1812;
const DEFAULT_RADIUS_ACCOUNTING_PORT = 1813;
const RADIUS_SECRET_KEY = "RADIUS_SECRET";
const ISOLIR_URL_KEY = "ISOLIR_URL";
const DEFAULT_RADIUS_SECRET = "testing123";
const MISSING_RADIUS_SECRET_ERROR = "RADIUS secret belum dikonfigurasi";

function getNonEmptyString(
  value: string | null | undefined,
): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function getNumberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSettingValue(
  settings: Array<{ key: string; value: string }>,
  key: string,
): string | undefined {
  return getNonEmptyString(settings.find((item) => item.key === key)?.value);
}

function getEnvRadiusSecret(): string | undefined {
  return getNonEmptyString(process.env.RADIUS_SECRET);
}

function getFallbackRadiusSecret(radiusSecret?: string): string {
  return radiusSecret || DEFAULT_RADIUS_SECRET;
}

function requireRadiusSecret(radiusSecret?: string): string {
  if (!radiusSecret) {
    throw new Error(MISSING_RADIUS_SECRET_ERROR);
  }

  return radiusSecret;
}

export function getRadiusDefaultPorts() {
  return {
    authPort: getNumberFromEnv(
      process.env.RADIUS_AUTH_PORT,
      DEFAULT_RADIUS_AUTH_PORT,
    ),
    accountingPort: getNumberFromEnv(
      process.env.RADIUS_ACCT_PORT,
      DEFAULT_RADIUS_ACCOUNTING_PORT,
    ),
  };
}

export async function getRadiusSecret(
  networkRepository: Pick<IRouterAccessRepository, "findSettingByKey">,
): Promise<string> {
  const envSecret = getEnvRadiusSecret();
  if (envSecret) {
    return envSecret;
  }

  const setting = await networkRepository.findSettingByKey(RADIUS_SECRET_KEY);
  return getFallbackRadiusSecret(getNonEmptyString(setting?.value));
}

export async function getRouterReconfigureSettings(
  networkRepository: Pick<NetworkRepository, "findSettingsByKeys">,
): Promise<{
  radiusSecret: string;
  isolirUrl?: string;
}> {
  const settings = await networkRepository.findSettingsByKeys([
    RADIUS_SECRET_KEY,
    ISOLIR_URL_KEY,
  ]);

  return {
    radiusSecret: requireRadiusSecret(
      getEnvRadiusSecret() ?? getSettingValue(settings, RADIUS_SECRET_KEY),
    ),
    isolirUrl: getSettingValue(settings, ISOLIR_URL_KEY),
  };
}
