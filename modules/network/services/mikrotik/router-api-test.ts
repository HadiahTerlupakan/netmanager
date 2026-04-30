import { logger } from "@/lib/logger";
import { RouterOSAPI } from "node-routeros-v2";

const DEFAULT_API_TIMEOUT_MS = 10000;
const TIMEOUT_GRACE_MS = 1000;
const DEFAULT_ROUTER_INFO = "Unknown";

export interface RouterInfo {
  identity: string;
  version: string;
  boardName: string;
  uptime: string;
  userOnline: number;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  routerInfo?: RouterInfo;
}

export type MikroTikAPIConfig = {
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
};

/** Test MikroTik API connectivity and read basic router info. */
export async function testMikroTikAPI(
  config: MikroTikAPIConfig,
): Promise<TestConnectionResult> {
  return new Promise((resolve) => {
    const timeout = config.timeout ?? DEFAULT_API_TIMEOUT_MS;
    const conn = createConnection(config, timeout);
    let resolved = false;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      closeConnection(conn);
    };

    const timer = setTimeout(() => {
      cleanup();
      resolve({ success: false, message: getTimeoutMessage(timeout) });
    }, timeout + TIMEOUT_GRACE_MS);

    conn
      .connect()
      .then(() => handleConnected(conn, cleanup, timer, resolve))
      .catch((error: { message?: string; code?: string }) => {
        cleanup();
        clearTimeout(timer);
        resolve({
          success: false,
          message: formatConnectionError(error, config.ipAddress, config.port),
        });
      });
  });
}

function createConnection(config: MikroTikAPIConfig, timeout: number) {
  return new RouterOSAPI({
    host: config.ipAddress,
    user: config.username,
    password: config.password,
    port: config.port,
    timeout,
  });
}

async function handleConnected(
  conn: RouterOSAPI,
  cleanup: () => void,
  timer: NodeJS.Timeout,
  resolve: (result: TestConnectionResult) => void,
) {
  try {
    const routerInfo = await readRouterInfo(conn);
    cleanup();
    clearTimeout(timer);
    resolve({
      success: true,
      message: `Koneksi API berhasil! Router: ${routerInfo.identity}, Version: ${routerInfo.version}, User Online: ${routerInfo.userOnline}`,
      routerInfo,
    });
  } catch (error: unknown) {
    cleanup();
    clearTimeout(timer);
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error getting router info:", error);
    resolve({
      success: true,
      message: `Koneksi API berhasil, tetapi gagal mengambil informasi router: ${errorMessage}`,
    });
  }
}

async function readRouterInfo(conn: RouterOSAPI): Promise<RouterInfo> {
  const [identity, resource, pppActive] = await Promise.all([
    readRouterOSData(conn, "/system/identity/print"),
    readRouterOSData(conn, "/system/resource/print"),
    readRouterOSData(conn, "/ppp/active/print"),
  ]);

  const identityData = normalizeRouterOSRecord(identity);
  const resourceData = normalizeRouterOSRecord(resource);
  const userOnline = Array.isArray(pppActive) ? pppActive.length : 0;

  return {
    identity: getStringValue(identityData, "name", ".name"),
    version: getStringValue(resourceData, "version", ".version"),
    boardName: getStringValue(resourceData, "board-name", "boardName"),
    uptime: getStringValue(resourceData, "uptime", ".uptime"),
    userOnline,
  };
}

async function readRouterOSData(conn: RouterOSAPI, command: string) {
  try {
    return await conn.write(command);
  } catch (_error) {
    return null;
  }
}

function normalizeRouterOSRecord(
  value: unknown,
): Record<string, unknown> | null {
  if (Array.isArray(value))
    return (value[0] as Record<string, unknown>) || null;
  return (value as Record<string, unknown>) || null;
}

function getStringValue(
  record: Record<string, unknown> | null,
  primaryKey: string,
  fallbackKey: string,
) {
  if (!record) return DEFAULT_ROUTER_INFO;
  return String(
    record[primaryKey] || record[fallbackKey] || DEFAULT_ROUTER_INFO,
  );
}

function formatConnectionError(
  error: { message?: string; code?: string },
  ipAddress: string,
  port: number,
) {
  if (error.message?.includes("timeout") || error.code === "ETIMEDOUT") {
    return "Koneksi timeout - kemungkinan IP Address salah atau router tidak dapat dijangkau";
  }
  if (
    error.message?.includes("ECONNREFUSED") ||
    error.code === "ECONNREFUSED"
  ) {
    return `Port ${port} ditolak - kemungkinan API MikroTik tidak aktif atau firewall memblokir`;
  }
  if (error.message?.includes("ENOTFOUND") || error.code === "ENOTFOUND") {
    return `Host ${ipAddress} tidak dapat dijangkau`;
  }
  if (
    error.message?.includes("invalid user name or password") ||
    error.message?.includes("authentication")
  ) {
    return "Autentikasi gagal - Username atau Password salah";
  }
  return `Koneksi API gagal: ${error.message || error.code || "Terjadi kesalahan"}`;
}

function getTimeoutMessage(timeout: number) {
  return `Koneksi API timeout setelah ${timeout}ms - kemungkinan kredensial salah atau router tidak dapat dijangkau`;
}

function closeConnection(conn: RouterOSAPI) {
  try {
    conn.close();
  } catch (_error) {}
}
