import { logger } from "@/lib/logger";
import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikConnectionHelper } from "./MikroTikConnectionHelper";

const PROXY_PORT = 8181;
const EXPIRED_NETWORK = "10.127.0.0/18";
const PROXY_COMMENT = "added by netmanager - 10.127.0.0/18";

/** Service untuk provisioning Web Proxy (Isolir redirection) di MikroTik. */
export class WebProxyProvisioningService {
  constructor(private readonly helper: MikroTikConnectionHelper) {}

  /** Provision web proxy untuk isolir redirection. */
  async provisionWebProxy(
    conn: RouterOSAPI,
    isolirUrl: string | null | undefined,
  ): Promise<string[]> {
    const logs: string[] = [];

    if (!isolirUrl) {
      return logs;
    }

    try {
      const domain = this.extractDomain(isolirUrl);
      if (!domain) {
        logger.warn("[WebProxy] Invalid Isolir URL format");
        return logs;
      }

      await this.enableProxy(conn);
      logs.push(`Configured Web Proxy: Enabled on port ${PROXY_PORT}`);

      await this.addProxyAccessRule(conn, domain, logs);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error(`[WebProxy] Error: ${msg}`);
      logs.push(`Failed to configure Web Proxy: ${msg}`);
    }

    return logs;
  }

  /** Deprovision web proxy configuration. */
  async deprovisionWebProxy(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];

    const existing = await this.findProxyAccessRule(conn);
    if (existing.length > 0) {
      for (const rule of existing) {
        await conn.write("/ip/proxy/access/remove", ["=.id=" + rule[".id"]]);
        await this.helper.delay(200);
        logs.push(`Removed Web Proxy Access Rule (ID: ${rule[".id"]})`);
      }
    }

    return logs;
  }

  private extractDomain(url: string): string | null {
    try {
      const domain = url.replace(/^https?:\/\//, "").split("/")[0];
      return domain || null;
    } catch {
      return null;
    }
  }

  private async enableProxy(conn: RouterOSAPI): Promise<void> {
    await conn.write("/ip/proxy/set", ["=enabled=yes", "=port=" + PROXY_PORT]);
    await this.helper.delay(200);
  }

  private async addProxyAccessRule(
    conn: RouterOSAPI,
    domain: string,
    logs: string[],
  ): Promise<void> {
    const existing = await this.findProxyAccessRule(conn);

    if (existing.length === 0) {
      await conn.write("/ip/proxy/access/add", [
        "=src-address=" + EXPIRED_NETWORK,
        "=action=redirect",
        "=action-data=" + domain,
        "=comment=" + PROXY_COMMENT,
      ]);
      await this.helper.delay(200);
      logs.push(
        `Added Web Proxy Access Rule: Redirect ${EXPIRED_NETWORK} to ${domain}`,
      );
    }
  }

  private async findProxyAccessRule(
    conn: RouterOSAPI,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/ip/proxy/access/print", [
      "?comment=" + PROXY_COMMENT,
    ])) as Array<{ ".id": string }>;
  }
}
