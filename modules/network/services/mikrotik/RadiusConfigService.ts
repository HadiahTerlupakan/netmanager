import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikConnectionHelper } from "./MikroTikConnectionHelper";

const DEFAULT_AUTH_PORT = 1812;
const DEFAULT_ACCOUNTING_PORT = 1813;
const DEFAULT_TIMEOUT = "3000ms";
const RADIUS_SERVICES = "ppp,login,hotspot";
const RADIUS_COMMENT = "added by netmanager";
const COA_PORT = 3799;

export interface RadiusConfig {
  serverIp: string;
  secret: string;
  authPort?: number;
  accountingPort?: number;
}

export interface ProvisionResult {
  success: boolean;
  logs: string[];
}

/** Service untuk provisioning RADIUS configuration di MikroTik. */
export class RadiusConfigService {
  constructor(private readonly helper: MikroTikConnectionHelper) {}

  /** Provision RADIUS configuration. */
  async provisionRadius(
    conn: RouterOSAPI,
    config: RadiusConfig,
  ): Promise<string[]> {
    const logs: string[] = [];
    const authPort = config.authPort ?? DEFAULT_AUTH_PORT;
    const accountingPort = config.accountingPort ?? DEFAULT_ACCOUNTING_PORT;

    logs.push(`Using Server IP for RADIUS: ${config.serverIp}`);
    logs.push(`Auth Port: ${authPort}, Accounting Port: ${accountingPort}`);

    const existingRadius = await this.findExistingRadius(conn, config.serverIp);

    if (existingRadius.length > 0) {
      await this.updateExistingRadius(
        conn,
        existingRadius,
        config,
        authPort,
        accountingPort,
      );
      logs.push(
        `Updated existing RADIUS config for ${config.serverIp} (auth:${authPort}, acct:${accountingPort})`,
      );
    } else {
      await this.addNewRadius(conn, config, authPort, accountingPort);
      logs.push(
        `Added new RADIUS config for ${config.serverIp} (auth:${authPort}, acct:${accountingPort})`,
      );
    }

    await this.configureCoA(conn);
    logs.push(`Configured RADIUS Incoming (CoA) on port ${COA_PORT}`);

    return logs;
  }

  /** Deprovision RADIUS configuration. */
  async deprovisionRadius(
    conn: RouterOSAPI,
    serverIp: string,
  ): Promise<string[]> {
    const logs: string[] = [];
    const existingRadius = await this.findExistingRadius(conn, serverIp);

    if (existingRadius.length > 0) {
      for (const r of existingRadius) {
        await conn.write("/radius/remove", ["=.id=" + r[".id"]]);
        await this.helper.delay(200);
        logs.push(`Removed RADIUS config for ${serverIp} (ID: ${r[".id"]})`);
      }
    }

    return logs;
  }

  private async findExistingRadius(
    conn: RouterOSAPI,
    serverIp: string,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/radius/print", [
      "?address=" + serverIp,
      "?comment=" + RADIUS_COMMENT,
    ])) as Array<{ ".id": string }>;
  }

  private async updateExistingRadius(
    conn: RouterOSAPI,
    existingRadius: Array<{ ".id": string }>,
    config: RadiusConfig,
    authPort: number,
    accountingPort: number,
  ): Promise<void> {
    for (const r of existingRadius) {
      await conn.write("/radius/set", [
        "=.id=" + r[".id"],
        "=secret=" + config.secret,
        "=service=" + RADIUS_SERVICES,
        "=authentication-port=" + authPort,
        "=accounting-port=" + accountingPort,
        "=timeout=" + DEFAULT_TIMEOUT,
      ]);
      await this.helper.delay(300);
    }
  }

  private async addNewRadius(
    conn: RouterOSAPI,
    config: RadiusConfig,
    authPort: number,
    accountingPort: number,
  ): Promise<void> {
    await conn.write("/radius/add", [
      "=address=" + config.serverIp,
      "=secret=" + config.secret,
      "=service=" + RADIUS_SERVICES,
      "=authentication-port=" + authPort,
      "=accounting-port=" + accountingPort,
      "=timeout=" + DEFAULT_TIMEOUT,
      "=comment=" + RADIUS_COMMENT,
    ]);
    await this.helper.delay(300);
  }

  private async configureCoA(conn: RouterOSAPI): Promise<void> {
    await conn.write("/radius/incoming/set", [
      "=accept=yes",
      "=port=" + COA_PORT,
    ]);
    await this.helper.delay(200);
  }
}
