import { logger } from "@/lib/logger";
import type { RouterOSAPI } from "node-routeros-v2";

const VERIFY_DELAY_MS = 500;
const RETRY_VERIFY_DELAY_MS = 1000;

type OperationResult = { success: boolean; error?: string };

/** Delete a Netmanager-managed IP pool from MikroTik. */
export async function deleteManagedIPPool(
  conn: RouterOSAPI,
  poolName: string,
): Promise<OperationResult> {
  try {
    const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);
    const pool = pools?.[0];
    if (!pool || pool.comment !== getManagedComment(poolName)) {
      return { success: true };
    }

    await conn.write("/ip/pool/remove", ["=.id=" + pool[".id"]]);
    await waitForRouterOS(VERIFY_DELAY_MS);
    return verifyIPPoolDeleted(conn, poolName);
  } catch (error) {
    logger.error("[MikroTik IP Pool] Error deleting pool:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal menghapus IP Pool di MikroTik",
    };
  }
}

/** Delete a PPP profile from MikroTik and retry once when RouterOS lags. */
export async function removePPPProfileByName(
  conn: RouterOSAPI,
  profileName: string,
): Promise<OperationResult> {
  const profiles = await conn.write("/ppp/profile/print", [
    "?name=" + profileName,
  ]);
  const profile = profiles?.[0];
  if (!profile) return { success: true };

  await conn.write("/ppp/profile/remove", ["=.id=" + profile[".id"]]);
  await waitForRouterOS(VERIFY_DELAY_MS);
  return verifyPPPProfileDeleted(conn, profileName);
}

async function verifyIPPoolDeleted(
  conn: RouterOSAPI,
  poolName: string,
): Promise<OperationResult> {
  const pool = await findManagedIPPool(conn, poolName);
  if (!pool) return { success: true };

  logger.warn("[MikroTik IP Pool] WARNING: Pool masih ada setelah dihapus!");
  await conn.write("/ip/pool/remove", ["=.id=" + pool[".id"]]);
  await waitForRouterOS(RETRY_VERIFY_DELAY_MS);

  const retryPool = await findManagedIPPool(conn, poolName);
  if (!retryPool) return { success: true };

  logger.error(
    "[MikroTik IP Pool] ERROR: Pool masih ada setelah retry delete!",
  );
  return {
    success: false,
    error:
      "IP Pool tidak dapat dihapus dari MikroTik. Pastikan pool tidak sedang digunakan.",
  };
}

async function verifyPPPProfileDeleted(
  conn: RouterOSAPI,
  profileName: string,
): Promise<OperationResult> {
  const profile = await findPPPProfile(conn, profileName);
  if (!profile) return { success: true };

  logger.warn("[MikroTik PPP] WARNING: Profile masih ada setelah dihapus!");
  await conn.write("/ppp/profile/remove", ["=.id=" + profile[".id"]]);
  await waitForRouterOS(RETRY_VERIFY_DELAY_MS);

  const retryProfile = await findPPPProfile(conn, profileName);
  if (!retryProfile) return { success: true };

  logger.error("[MikroTik PPP] ERROR: Profile masih ada setelah retry delete!");
  return {
    success: false,
    error:
      "Profile tidak dapat dihapus dari MikroTik. Pastikan profile tidak sedang digunakan oleh PPPoE client.",
  };
}

async function findManagedIPPool(conn: RouterOSAPI, poolName: string) {
  const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);
  const pool = pools?.[0];
  if (!pool || pool.comment !== getManagedComment(poolName)) return null;
  return pool;
}

async function findPPPProfile(conn: RouterOSAPI, profileName: string) {
  const profiles = await conn.write("/ppp/profile/print", [
    "?name=" + profileName,
  ]);
  return profiles?.[0] || null;
}

function getManagedComment(name: string) {
  return `add by netmanager - ${name}`;
}

function waitForRouterOS(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
