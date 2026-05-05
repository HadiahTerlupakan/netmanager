import { logger } from "@/lib/logger";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikRouterResolver } from "./mikrotik/MikroTikRouterResolver";
import {
  buildCreateProfileParams,
  buildUpdateProfileParams,
} from "./mikrotik/ppp-profile-params";
import type { PPPProfileData } from "./mikrotik/ppp-profile.types";
import {
  checkIPPoolExists,
  connectToMikroTik,
  createIPPool,
} from "./mikrotik-ip-pool-client";

const routerResolver = new MikroTikRouterResolver();
const networkRepository = new NetworkRepository();
const VERIFY_DELAY_MS = 500;

export type MikroTikConnection = Awaited<ReturnType<typeof connectToMikroTik>>;
type VerifyProfileResult =
  | { success: true; profile: Record<string, string> }
  | { success: false; error: string };

function getRouterConnectionInput(router: {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiUsernameGenerated: string | null;
  apiPassword: string;
  apiPasswordGenerated: string | null;
}) {
  return {
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsernameGenerated || router.apiUsername,
    apiPassword: router.apiPasswordGenerated || router.apiPassword,
  };
}

function getTrapError(result: unknown): string | null {
  if (!Array.isArray(result) || !result[0] || typeof result[0] !== "object") {
    return null;
  }

  const firstResult = result[0] as Record<string, string>;
  return firstResult["!trap"]
    ? firstResult.message || "Terjadi kesalahan"
    : null;
}

function createMissingPoolResult(poolName: string) {
  return {
    success: false as const,
    error:
      `IP Pool "${poolName}" tidak ditemukan. ` +
      "Silakan buat IP Pool terlebih dahulu atau berikan IP Range untuk membuat otomatis.",
  };
}

function createMissingUpdatedPoolResult(poolName: string) {
  return {
    success: false as const,
    error:
      `IP Pool "${poolName}" tidak ditemukan. ` +
      "Silakan berikan IP Range untuk membuat otomatis.",
  };
}

async function createPoolWhenRangeProvided(
  conn: MikroTikConnection,
  poolName: string,
  ipRange?: string,
) {
  if (!ipRange || ipRange.trim() === "") {
    return null;
  }

  return createIPPool(conn, poolName, ipRange);
}

export async function ensureCreateProfilePool(
  conn: MikroTikConnection,
  profileData: PPPProfileData,
) {
  if (profileData.skipPoolCheck) {
    return { success: true as const };
  }

  const poolResult = await createPoolWhenRangeProvided(
    conn,
    profileData.remoteAddress,
    profileData.ipRange,
  );
  if (poolResult) {
    return poolResult.success
      ? { success: true as const }
      : {
          success: false as const,
          error: `Gagal membuat IP Pool: ${poolResult.error}`,
        };
  }

  if (await checkIPPoolExists(conn, profileData.remoteAddress)) {
    return { success: true as const };
  }

  return createMissingPoolResult(profileData.remoteAddress);
}

export async function ensureUpdatedProfilePool(
  conn: MikroTikConnection,
  oldProfileData: Record<string, string>,
  profileData: Partial<PPPProfileData>,
) {
  if (
    profileData.skipPoolCheck ||
    (profileData.remoteAddress === undefined && !profileData.ipRange)
  ) {
    return { success: true as const };
  }

  const poolName =
    profileData.remoteAddress || oldProfileData["remote-address"];
  const poolResult = await createPoolWhenRangeProvided(
    conn,
    poolName,
    profileData.ipRange,
  );

  if (poolResult) {
    if (!poolResult.success) {
      logger.error(
        "[MikroTik PPP] Failed to update IP Pool:",
        poolResult.error,
      );
    }
    return { success: true as const };
  }

  if (
    profileData.remoteAddress &&
    profileData.remoteAddress !== oldProfileData["remote-address"] &&
    !(await checkIPPoolExists(conn, poolName))
  ) {
    return createMissingUpdatedPoolResult(poolName);
  }

  return { success: true as const };
}

async function waitBeforeVerify() {
  await new Promise((resolve) => setTimeout(resolve, VERIFY_DELAY_MS));
}

async function findProfileByName(
  conn: MikroTikConnection,
  profileName: string,
) {
  return conn.write("/ppp/profile/print", [`?name=${profileName}`]);
}

function createMissingVerifyResult(error: string): VerifyProfileResult {
  return { success: false, error };
}

export async function verifyProfileCreation(
  conn: MikroTikConnection,
  profileData: PPPProfileData,
): Promise<VerifyProfileResult> {
  await waitBeforeVerify();
  const profiles = await findProfileByName(conn, profileData.name);

  if (!profiles || profiles.length === 0) {
    return createMissingVerifyResult(
      "Profile dibuat tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.",
    );
  }

  return { success: true, profile: profiles[0] as Record<string, string> };
}

function getVerificationProfileName(
  profileName: string,
  profileData: Partial<PPPProfileData>,
) {
  return profileData.name && profileData.name !== profileName
    ? profileData.name
    : profileName;
}

export async function verifyProfileUpdate(
  conn: MikroTikConnection,
  profileName: string,
  profileData: Partial<PPPProfileData>,
): Promise<VerifyProfileResult> {
  await waitBeforeVerify();
  const profiles = await findProfileByName(
    conn,
    getVerificationProfileName(profileName, profileData),
  );

  if (!profiles || profiles.length === 0 || !profiles[0]) {
    return createMissingVerifyResult(
      "Profile diupdate tapi tidak ditemukan saat verifikasi. Periksa log untuk detail.",
    );
  }

  return { success: true, profile: profiles[0] as Record<string, string> };
}

export function warnRateLimitMismatch(
  profile: Record<string, string>,
  expectedRateLimit: string | undefined,
  actionLabel: string,
) {
  if (!expectedRateLimit || expectedRateLimit.trim() === "") {
    return;
  }

  const actualRateLimit = profile["rate-limit"] || profile.rateLimit || null;
  if (!actualRateLimit || actualRateLimit.trim() === "") {
    logger.warn(
      `[MikroTik PPP] WARNING: rate-limit tidak ter-set di MikroTik ${actionLabel}!`,
    );
    return;
  }

  if (actualRateLimit !== expectedRateLimit) {
    logger.warn(
      `[MikroTik PPP] WARNING: rate-limit tidak sesuai ${actionLabel}!`,
    );
  }
}

async function findRouterConnectionById(routerId: string) {
  const router = await routerResolver.findRouter(routerId);
  if (router) {
    return router;
  }

  return networkRepository.findRouterConnectionById(routerId);
}

export async function connectRouterById(routerId: string) {
  const router = await findRouterConnectionById(routerId);

  if (!router) {
    return { success: false as const, error: "Router tidak ditemukan" };
  }

  return {
    success: true as const,
    conn: await connectToMikroTik(getRouterConnectionInput(router)),
  };
}

export function closeConnectionSafely(conn: { close: () => void }) {
  try {
    conn.close();
  } catch {
    // noop
  }
}

export function buildCreateFallbackProfile(
  profileName: string,
  profileData: Partial<PPPProfileData>,
): PPPProfileData {
  return {
    name: profileData.name || profileName,
    localAddress: profileData.localAddress || "0.0.0.0",
    remoteAddress: profileData.remoteAddress || profileData.name || profileName,
    ...profileData,
  };
}

export function createConnectionErrorResult(error: unknown, fallback: string) {
  logger.error("Error connecting to MikroTik:", error);
  return {
    success: false,
    error: error instanceof Error ? error.message || fallback : fallback,
  };
}

export function createProfileOperationErrorResult(
  action: string,
  error: unknown,
  fallback: string,
) {
  logger.error(`Error ${action} PPP profile in MikroTik:`, error);
  return {
    success: false,
    error: error instanceof Error ? error.message || fallback : fallback,
  };
}

export function getCreateProfileParams(profileData: PPPProfileData) {
  return buildCreateProfileParams(profileData);
}

export function getUpdateProfileParams(
  profileName: string,
  profileData: Partial<PPPProfileData>,
) {
  return buildUpdateProfileParams(profileName, profileData);
}

export function getProfileSetCommand(
  profileId: string,
  updateParams: string[],
) {
  return ["=.id=" + profileId, ...updateParams];
}

export function getTrapErrorMessage(result: unknown) {
  const trapError = getTrapError(result);
  return trapError ? `MikroTik error: ${trapError}` : null;
}
