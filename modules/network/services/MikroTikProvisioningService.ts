import { detectPublicIp } from "./mikrotik-provisioning.ip-detection";
import { createProvisioningApiUser } from "./mikrotik-provisioning.api-user";
import {
  disableRadiusIncoming,
  enableRadiusIncoming,
  provisionRadiusConfig,
  removeRadiusConfig,
} from "./mikrotik-provisioning.radius";
import {
  provisionFirewallBypass,
  removeFirewallBypass,
} from "./mikrotik-provisioning.firewall";
import {
  provisionWebProxy,
  removeWebProxy,
} from "./mikrotik-provisioning.proxy";
import { provisionNatRules, removeNatRules } from "./mikrotik-provisioning.nat";
import {
  removeIsolirPageFile,
  writeIsolirPageFile,
} from "./mikrotik-provisioning.isolir-page";
import {
  runProvisioningConnection,
  type MikroTikProvisioningResult,
  type MikroTikProvisioningRouterDetails,
} from "./mikrotik-provisioning.connection";
import type { IsolirProvisioning } from "../isolir/isolir-provisioning";

const DEFAULT_RADIUS_AUTH_PORT = 1812;
const DEFAULT_RADIUS_ACCOUNTING_PORT = 1813;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createSuccessResult(
  logs: string[],
  isolirPageError?: string,
): MikroTikProvisioningResult {
  return isolirPageError
    ? { success: true, logs, isolirPageError }
    : { success: true, logs };
}

function createFailedResult(
  logs: string[],
  error: unknown,
): MikroTikProvisioningResult {
  const message = getErrorMessage(error);
  return {
    success: false,
    logs: [...logs, `Error: ${message}`],
    error: message,
  };
}

// Halaman yang gagal ditulis tidak menggagalkan provisioning: RADIUS dan
// firewall sudah terpasang, dan isolir tetap berjalan dengan halaman bawaan
// web proxy. Galatnya dikembalikan untuk status kirim halaman.
async function provisionIsolirPage(
  connection: Parameters<typeof writeIsolirPageFile>[0],
  html: string,
  logs: string[],
): Promise<string | undefined> {
  try {
    await writeIsolirPageFile(connection, html, logs);
    return undefined;
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    logs.push(`Failed to write isolir page: ${message}`);
    return message;
  }
}

async function restoreDefaultProxyPage(
  connection: Parameters<typeof removeIsolirPageFile>[0],
  logs: string[],
): Promise<void> {
  try {
    await removeIsolirPageFile(connection, logs);
  } catch (error: unknown) {
    logs.push(
      `Failed to reset Web Proxy HTML pages: ${getErrorMessage(error)}`,
    );
  }
}

export class MikroTikProvisioningService {
  /**
   * Provision konfigurasi RADIUS, firewall, dan proxy pada router MikroTik.
   * `isolir` menentukan apa yang dilihat pelanggan isolir; mode ROUTER_PAGE
   * juga menulis halamannya ke router. `srcAddress` diisi untuk router VPN
   * agar RADIUS dikirim dari IP tunnel.
   */
  async provisionRadius(
    routerDetails: MikroTikProvisioningRouterDetails,
    radiusServerIp: string | null,
    radiusSecret: string,
    isolir: IsolirProvisioning | null = null,
    authPort: number = DEFAULT_RADIUS_AUTH_PORT,
    accountingPort: number = DEFAULT_RADIUS_ACCOUNTING_PORT,
    srcAddress?: string | null,
  ): Promise<MikroTikProvisioningResult> {
    const logs: string[] = [];
    const serverIp = radiusServerIp || (await detectPublicIp());
    logs.push(`Using Server IP for RADIUS: ${serverIp}`);
    logs.push(`Auth Port: ${authPort}, Accounting Port: ${accountingPort}`);

    try {
      let isolirPageError: string | undefined;
      await runProvisioningConnection({
        routerDetails,
        operation: async (connection) => {
          logs.push(`Connected to MikroTik at ${routerDetails.ip}`);
          await provisionRadiusConfig({
            connection,
            serverIp,
            radiusSecret,
            authPort,
            accountingPort,
            logs,
            srcAddress,
          });
          await enableRadiusIncoming({ connection, logs });
          await provisionFirewallBypass({ connection, serverIp, isolir, logs });
          // Proxy yang gagal membuat halaman tidak tersaji, jadi galatnya
          // dicatat sebagai galat halaman tanpa menggagalkan provisioning.
          const proxyError = await provisionWebProxy({
            connection,
            isolir,
            logs,
          });
          await provisionNatRules({ connection, logs });
          // Ditulis paling akhir: reset-html atau /file/set yang macet atau
          // gagal tidak boleh menahan rule NAT isolir.
          const pageError =
            isolir?.mode === "ROUTER_PAGE"
              ? await provisionIsolirPage(connection, isolir.html, logs)
              : undefined;
          isolirPageError = proxyError ?? pageError;
        },
      });

      return createSuccessResult(logs, isolirPageError);
    } catch (error: unknown) {
      return createFailedResult(logs, error);
    }
  }

  /**
   * Hapus konfigurasi provisioning NetManager dari router MikroTik. Bagian
   * isolir dihapus seluruhnya menurut kepemilikannya (list, comment, file),
   * bukan menurut URL yang dihitung ulang.
   */
  async deprovisionRadius(
    routerDetails: MikroTikProvisioningRouterDetails,
    radiusServerIp: string | null,
  ): Promise<MikroTikProvisioningResult> {
    const logs: string[] = [];
    const serverIp = radiusServerIp || (await detectPublicIp());

    try {
      await runProvisioningConnection({
        routerDetails,
        operation: async (connection) => {
          logs.push(`Connected to MikroTik at ${routerDetails.ip}`);
          await removeRadiusConfig({ connection, serverIp, logs });
          await restoreDefaultProxyPage(connection, logs);
          // Proxy dimatikan sebelum guard 8181 dibuang bersama firewall,
          // agar putus di tengah tidak meninggalkan open proxy tanpa guard.
          await removeWebProxy({ connection, logs });
          await removeFirewallBypass({ connection, logs });
          await removeNatRules({ connection, logs });
          await disableRadiusIncoming({ connection, logs });
        },
      });

      return createSuccessResult(logs);
    } catch (error: unknown) {
      return createFailedResult(logs, error);
    }
  }

  /** Buat user API terbatas untuk koneksi rutin aplikasi ke router. */
  async createApiUser(routerDetails: MikroTikProvisioningRouterDetails) {
    return createProvisioningApiUser(routerDetails);
  }
}
