import { logger } from "@/lib/logger";
import { RadiusConnectionError } from "../utils/errors";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { RouterOSAPI } from "node-routeros-v2";

export type MikroTikRouterConfig = {
  ipAddress: string;
  apiPort: number;
  apiUsername: string;
  apiPassword: string;
};

export type MikroTikOperationResult = {
  success: boolean;
  error?: string;
};

export async function connectToMikroTik(
  config: MikroTikRouterConfig,
  timeout: number = 5000,
): Promise<RouterOSAPI> {
  const conn = new RouterOSAPI({
    host: config.ipAddress,
    user: config.apiUsername,
    password: config.apiPassword,
    port: config.apiPort,
    timeout,
  });

  await conn.connect();
  return conn;
}

/** Check whether an IP pool exists on MikroTik. */
export async function checkIPPoolExists(
  conn: RouterOSAPI,
  poolName: string,
): Promise<boolean> {
  try {
    const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);
    return pools && pools.length > 0;
  } catch (error) {
    logger.error("[MikroTik IP Pool] Error checking pool:", error);
    throw new RadiusConnectionError(
      "Gagal terhubung ke router: " +
        (error instanceof Error ? error.message : String(error)),
    );
  }
}

/** Get IP pool ranges from a MikroTik router. */
export async function getIPPoolRanges(
  routerId: string,
  poolName: string,
): Promise<{ success: boolean; ranges?: string; error?: string }> {
  try {
    const conn = await connectToRouter(routerId);
    if (!conn) return { success: false, error: "Router tidak ditemukan" };
    return await readPoolRanges(conn, poolName);
  } catch (error) {
    logger.error("[MikroTik IP Pool] Error connecting to MikroTik:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal terhubung ke MikroTik Router",
    };
  }
}

/** Create or update an IP pool on MikroTik. */
export async function createIPPool(
  conn: RouterOSAPI,
  poolName: string,
  ipRange: string,
): Promise<MikroTikOperationResult> {
  try {
    const existingPools = await conn.write("/ip/pool/print", [
      "?name=" + poolName,
    ]);
    if (existingPools?.[0])
      return updateIPPool(conn, poolName, ipRange, existingPools[0][".id"]);
    return addIPPool(conn, poolName, ipRange);
  } catch (error) {
    logger.error("[MikroTik IP Pool] Error creating/updating pool:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal membuat/update IP Pool di MikroTik",
    };
  }
}

async function connectToRouter(routerId: string) {
  const networkRepo = new NetworkRepository();
  const routerTenant = await networkRepo.findRouterTenantId(routerId);
  const routerRepo = new MikroTikRouterRepository();
  const router = routerTenant
    ? await routerRepo.findById(routerId, routerTenant.tenantId!)
    : null;
  if (!router) return null;
  return connectToMikroTik({
    ipAddress: router.ipAddress,
    apiPort: router.apiPort,
    apiUsername: router.apiUsernameGenerated || router.apiUsername,
    apiPassword: router.apiPasswordGenerated || router.apiPassword,
  });
}

async function readPoolRanges(conn: RouterOSAPI, poolName: string) {
  try {
    const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);
    const ranges = pools?.[0]?.["ranges"] || null;
    conn.close();
    if (!pools?.[0])
      return { success: false, error: "IP Pool tidak ditemukan" };
    if (!ranges?.trim()) {
      return { success: false, error: "IP Pool tidak memiliki ranges" };
    }
    return { success: true, ranges };
  } catch (error) {
    conn.close();
    logger.error("[MikroTik IP Pool] Error getting pool ranges:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: errorMessage || "Gagal mengambil IP Pool ranges dari MikroTik",
    };
  }
}

async function updateIPPool(
  conn: RouterOSAPI,
  poolName: string,
  ipRange: string,
  poolId: string,
) {
  const result = await conn.write("/ip/pool/set", [
    `=.id=${poolId}`,
    `=ranges=${ipRange}`,
    `=comment=${getPoolComment(poolName)}`,
  ]);
  const trap = getTrapMessage(result);
  if (trap) return { success: false, error: `MikroTik error: ${trap}` };
  return verifyPool(
    conn,
    poolName,
    "IP Pool diupdate tapi tidak ditemukan saat verifikasi",
  );
}

async function addIPPool(conn: RouterOSAPI, poolName: string, ipRange: string) {
  const result = await conn.write("/ip/pool/add", [
    `=name=${poolName}`,
    `=ranges=${ipRange}`,
    `=comment=${getPoolComment(poolName)}`,
  ]);
  const trap = getTrapMessage(result);
  if (trap) return { success: false, error: `MikroTik error: ${trap}` };
  return verifyPool(
    conn,
    poolName,
    "IP Pool dibuat tapi tidak ditemukan saat verifikasi",
  );
}

async function verifyPool(
  conn: RouterOSAPI,
  poolName: string,
  missingMessage: string,
): Promise<MikroTikOperationResult> {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const pools = await conn.write("/ip/pool/print", ["?name=" + poolName]);
  if (!pools?.length) return { success: false, error: missingMessage };
  return { success: true };
}

function getTrapMessage(result: unknown) {
  if (!Array.isArray(result) || !result[0]?.["!trap"]) return null;
  return result[0]["message"] || "Terjadi kesalahan";
}

function getPoolComment(poolName: string) {
  return `add by netmanager - ${poolName}`;
}
