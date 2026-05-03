import { RouterOSAPI } from "node-routeros-v2";
import { MikroTikConnectionHelper } from "./MikroTikConnectionHelper";

const EXPIRED_POOL_NAME = "expired-pool";
const EXPIRED_POOL_RANGES = "10.127.0.2-10.127.63.254";
const EXPIRED_PROFILE_NAME = "expired users";
const EXPIRED_LOCAL_ADDRESS = "10.127.0.1";
const DNS_SERVERS = "8.8.8.8,1.1.1.1";
const NETMANAGER_COMMENT = "added by netmanager";

/** Service untuk provisioning IP Pool dan PPP Profile di MikroTik. */
export class IpPoolProvisioningService {
  constructor(private readonly helper: MikroTikConnectionHelper) {}

  /** Provision IP pool untuk expired users. */
  async provisionExpiredPool(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];
    const exists = await this.poolExists(conn);

    if (!exists) {
      await conn.write("/ip/pool/add", [
        "=name=" + EXPIRED_POOL_NAME,
        "=ranges=" + EXPIRED_POOL_RANGES,
        "=comment=" + NETMANAGER_COMMENT + " - expired users",
      ]);
      await this.helper.delay(200);
      logs.push(`Added IP Pool: ${EXPIRED_POOL_NAME} (${EXPIRED_POOL_RANGES})`);
    }

    return logs;
  }

  /** Provision PPP profile untuk expired users. */
  async provisionExpiredProfile(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];
    const existing = await this.findExpiredProfile(conn);

    if (existing.length === 0) {
      await conn.write("/ppp/profile/add", [
        "=name=" + EXPIRED_PROFILE_NAME,
        "=local-address=" + EXPIRED_LOCAL_ADDRESS,
        "=remote-address=" + EXPIRED_POOL_NAME,
        "=dns-server=" + DNS_SERVERS,
        "=comment=" + NETMANAGER_COMMENT,
      ]);
      await this.helper.delay(200);
      logs.push(`Added PPP Profile: ${EXPIRED_PROFILE_NAME}`);
    } else {
      await this.updateExpiredProfile(conn, existing[0][".id"]);
      logs.push(`Updated PPP Profile: ${EXPIRED_PROFILE_NAME}`);
    }

    return logs;
  }

  /** Deprovision IP pool dan PPP profile. */
  async deprovisionExpiredResources(conn: RouterOSAPI): Promise<string[]> {
    const logs: string[] = [];

    // Remove PPP Profile first (depends on pool)
    const profile = await this.findExpiredProfile(conn);
    if (profile.length > 0) {
      await conn.write("/ppp/profile/remove", ["=.id=" + profile[0][".id"]]);
      await this.helper.delay(200);
      logs.push(`Removed PPP Profile: ${EXPIRED_PROFILE_NAME}`);
    }

    // Remove IP Pool
    const pool = await this.findExpiredPool(conn);
    if (pool.length > 0) {
      await conn.write("/ip/pool/remove", ["=.id=" + pool[0][".id"]]);
      await this.helper.delay(200);
      logs.push(`Removed IP Pool: ${EXPIRED_POOL_NAME}`);
    }

    return logs;
  }

  private async poolExists(conn: RouterOSAPI): Promise<boolean> {
    const pool = await this.findExpiredPool(conn);
    return pool.length > 0;
  }

  private async findExpiredPool(
    conn: RouterOSAPI,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/ip/pool/print", [
      "?name=" + EXPIRED_POOL_NAME,
    ])) as Array<{ ".id": string }>;
  }

  private async findExpiredProfile(
    conn: RouterOSAPI,
  ): Promise<Array<{ ".id": string }>> {
    return (await conn.write("/ppp/profile/print", [
      "?name=" + EXPIRED_PROFILE_NAME,
    ])) as Array<{ ".id": string }>;
  }

  private async updateExpiredProfile(
    conn: RouterOSAPI,
    id: string,
  ): Promise<void> {
    await conn.write("/ppp/profile/set", [
      "=.id=" + id,
      "=local-address=" + EXPIRED_LOCAL_ADDRESS,
      "=remote-address=" + EXPIRED_POOL_NAME,
      "=dns-server=" + DNS_SERVERS,
    ]);
    await this.helper.delay(200);
  }
}
