import type { RouterOSAPI } from "node-routeros-v2";
import { logger } from "@/lib/logger";
import { IpDetectionService } from "./IpDetectionService";
import {
  MikroTikConnectionHelper,
  type RouterCredentials,
} from "./MikroTikConnectionHelper";
import { RadiusConfigService } from "./RadiusConfigService";
import { FirewallProvisioningService } from "./FirewallProvisioningService";
import { IpPoolProvisioningService } from "./IpPoolProvisioningService";
import { WebProxyProvisioningService } from "./WebProxyProvisioningService";
import { ApiUserService, type ApiUserResult } from "./ApiUserService";

export interface ProvisionResult {
  success: boolean;
  logs: string[];
}

/**
 * Orchestrator service untuk provisioning MikroTik router.
 * Mengkomposisi semua service kecil dengan Single Responsibility.
 */
export class MikroTikProvisioningService {
  private readonly ipDetection: IpDetectionService;
  private readonly connectionHelper: MikroTikConnectionHelper;
  private readonly radiusConfig: RadiusConfigService;
  private readonly firewallProvisioning: FirewallProvisioningService;
  private readonly ipPoolProvisioning: IpPoolProvisioningService;
  private readonly webProxyProvisioning: WebProxyProvisioningService;
  private readonly apiUserService: ApiUserService;

  constructor() {
    this.ipDetection = new IpDetectionService();
    this.connectionHelper = new MikroTikConnectionHelper();
    this.radiusConfig = new RadiusConfigService(this.connectionHelper);
    this.firewallProvisioning = new FirewallProvisioningService(
      this.connectionHelper,
    );
    this.ipPoolProvisioning = new IpPoolProvisioningService(
      this.connectionHelper,
    );
    this.webProxyProvisioning = new WebProxyProvisioningService(
      this.connectionHelper,
    );
    this.apiUserService = new ApiUserService(this.connectionHelper);
  }

  /** Provision RADIUS configuration dan firewall rules. */
  async provisionRadius(
    routerDetails: RouterCredentials,
    radiusServerIp: string | null,
    radiusSecret: string,
    isolirUrl: string | null | undefined = null,
    authPort: number = 1812,
    accountingPort: number = 1813,
  ): Promise<ProvisionResult> {
    const logs: string[] = [];
    const finalServerIp =
      radiusServerIp || (await this.ipDetection.detectPublicIp());

    const conn = this.connectionHelper.createConnection(routerDetails);

    try {
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      // 1. RADIUS Configuration
      const radiusLogs = await this.radiusConfig.provisionRadius(conn, {
        serverIp: finalServerIp,
        secret: radiusSecret,
        authPort,
        accountingPort,
      });
      logs.push(...radiusLogs);

      // 2. Firewall Address Lists
      const addressListLogs =
        await this.firewallProvisioning.provisionAddressLists(
          conn,
          finalServerIp,
          isolirUrl,
        );
      logs.push(...addressListLogs);

      // 3. Firewall Filter Rules
      const filterRulesLogs =
        await this.firewallProvisioning.provisionFilterRules(conn);
      logs.push(...filterRulesLogs);

      // 4. IP Pool & PPP Profile
      const poolLogs = await this.ipPoolProvisioning.provisionExpiredPool(conn);
      logs.push(...poolLogs);

      const profileLogs =
        await this.ipPoolProvisioning.provisionExpiredProfile(conn);
      logs.push(...profileLogs);

      // 5. Web Proxy (Isolir)
      const proxyLogs = await this.webProxyProvisioning.provisionWebProxy(
        conn,
        isolirUrl,
      );
      logs.push(...proxyLogs);

      conn.close();
      return { success: true, logs };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      this.safeCloseConnection(conn);
      return { success: false, logs };
    }
  }

  /** Deprovision RADIUS configuration dan firewall rules. */
  async deprovisionRadius(
    routerDetails: RouterCredentials,
    radiusServerIp: string | null,
    isolirUrl: string | null | undefined = null,
  ): Promise<ProvisionResult> {
    const logs: string[] = [];
    const finalServerIp =
      radiusServerIp || (await this.ipDetection.detectPublicIp());

    const conn = this.connectionHelper.createConnection(routerDetails);

    try {
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      // 1. Remove RADIUS Config
      const radiusLogs = await this.radiusConfig.deprovisionRadius(
        conn,
        finalServerIp,
      );
      logs.push(...radiusLogs);

      // 2. Remove Firewall Address Lists
      const addresses = this.buildAddressesToRemove(finalServerIp, isolirUrl);
      const addressListLogs =
        await this.firewallProvisioning.deprovisionAddressLists(
          conn,
          addresses,
        );
      logs.push(...addressListLogs);

      // 3. Remove Firewall Filter Rules
      const filterRulesLogs =
        await this.firewallProvisioning.deprovisionFilterRules(conn);
      logs.push(...filterRulesLogs);

      // 4. Remove IP Pool & PPP Profile
      const resourceLogs =
        await this.ipPoolProvisioning.deprovisionExpiredResources(conn);
      logs.push(...resourceLogs);

      // 5. Remove Web Proxy
      const proxyLogs =
        await this.webProxyProvisioning.deprovisionWebProxy(conn);
      logs.push(...proxyLogs);

      conn.close();
      return { success: true, logs };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      this.safeCloseConnection(conn);
      return { success: false, logs };
    }
  }

  /** Create API user dengan group dan permissions. */
  async createApiUser(
    routerDetails: RouterCredentials,
  ): Promise<ApiUserResult> {
    const logs: string[] = [];
    const conn = this.connectionHelper.createConnection(routerDetails);

    try {
      await conn.connect();
      logs.push(`Connected to MikroTik at ${routerDetails.ip}`);

      const result = await this.apiUserService.createApiUser(conn);
      logs.push(...result.logs);

      conn.close();
      return { ...result, logs };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logs.push(`Error: ${msg}`);
      this.safeCloseConnection(conn);
      return { success: false, logs };
    }
  }

  private buildAddressesToRemove(
    serverIp: string,
    isolirUrl: string | null | undefined,
  ): string[] {
    const addresses = [serverIp];

    if (isolirUrl) {
      try {
        const domain = isolirUrl.replace(/^https?:\/\//, "").split("/")[0];
        if (domain) {
          addresses.push(domain);
        }
      } catch (_e) {
        logger.warn("Invalid Isolir URL format");
      }
    }

    return addresses;
  }

  private safeCloseConnection(conn: RouterOSAPI | undefined): void {
    try {
      conn.close();
    } catch (_e) {
      // Ignore close errors
    }
  }
}
