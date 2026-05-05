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
import {
  runProvisioningConnection,
  type MikroTikProvisioningResult,
  type MikroTikProvisioningRouterDetails,
} from "./mikrotik-provisioning.connection";

const DEFAULT_RADIUS_AUTH_PORT = 1812;
const DEFAULT_RADIUS_ACCOUNTING_PORT = 1813;

function createSuccessResult(logs: string[]): MikroTikProvisioningResult {
  return { success: true, logs };
}

function createFailedResult(
  logs: string[],
  error: unknown,
): MikroTikProvisioningResult {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, logs: [...logs, `Error: ${message}`] };
}

export class MikroTikProvisioningService {
  /** Provision konfigurasi RADIUS, firewall, dan proxy pada router MikroTik. */
  async provisionRadius(
    routerDetails: MikroTikProvisioningRouterDetails,
    radiusServerIp: string | null,
    radiusSecret: string,
    isolirUrl: string | null | undefined = null,
    authPort: number = DEFAULT_RADIUS_AUTH_PORT,
    accountingPort: number = DEFAULT_RADIUS_ACCOUNTING_PORT,
  ): Promise<MikroTikProvisioningResult> {
    const logs: string[] = [];
    const serverIp = radiusServerIp || (await detectPublicIp());
    logs.push(`Using Server IP for RADIUS: ${serverIp}`);
    logs.push(`Auth Port: ${authPort}, Accounting Port: ${accountingPort}`);

    try {
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
          });
          await enableRadiusIncoming({ connection, logs });
          await provisionFirewallBypass({
            connection,
            serverIp,
            isolirUrl,
            logs,
          });
          await provisionWebProxy({ connection, isolirUrl, logs });
        },
      });

      return createSuccessResult(logs);
    } catch (error: unknown) {
      return createFailedResult(logs, error);
    }
  }

  /** Hapus konfigurasi provisioning NetManager dari router MikroTik. */
  async deprovisionRadius(
    routerDetails: MikroTikProvisioningRouterDetails,
    radiusServerIp: string | null,
    isolirUrl: string | null | undefined = null,
  ): Promise<MikroTikProvisioningResult> {
    const logs: string[] = [];
    const serverIp = radiusServerIp || (await detectPublicIp());

    try {
      await runProvisioningConnection({
        routerDetails,
        operation: async (connection) => {
          logs.push(`Connected to MikroTik at ${routerDetails.ip}`);
          await removeRadiusConfig({ connection, serverIp, logs });
          await removeFirewallBypass({
            connection,
            serverIp,
            isolirUrl,
            logs,
          });
          await removeWebProxy({ connection, isolirUrl, logs });
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
