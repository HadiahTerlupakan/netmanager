import * as snmp from "net-snmp";
import {
  MAX_CONCURRENT_SESSIONS,
  SESSION_REUSE_WINDOW_MS,
  SESSION_WAIT_MS,
  SNMP_TIMEOUT_MS,
} from "@/modules/network/services/snmp-optimized.constants";

export type SnmpSessionEntry = {
  session: snmp.Session;
  inUse: boolean;
  lastUsed: number;
};

export function createConnectionKey(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): string {
  return `${ipAddress}:${port}:${community}:${version}`;
}

function getSnmpVersion(version: string): 0 | 1 | undefined {
  return version === "1" ? 0 : 1;
}

function createSnmpSession(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
): snmp.Session {
  return snmp.createSession(ipAddress, community, {
    port,
    version: getSnmpVersion(version),
    retries: 2,
    timeout: SNMP_TIMEOUT_MS,
  });
}

function closePoolSession(session: snmp.Session): void {
  try {
    session.close();
  } catch {
    return;
  }
}

/** SNMP connection pool untuk session reuse dan concurrency control. */
export class SNMPConnectionPoolService {
  private sessions = new Map<string, SnmpSessionEntry[]>();

  async getSession(
    ipAddress: string,
    port: number,
    community: string,
    version: string,
  ): Promise<snmp.Session> {
    const key = createConnectionKey(ipAddress, port, community, version);
    const sessionList = this.sessions.get(key) ?? [];
    this.sessions.set(key, sessionList);

    const reusable = sessionList.find(
      (entry) =>
        !entry.inUse && Date.now() - entry.lastUsed < SESSION_REUSE_WINDOW_MS,
    );

    if (reusable) {
      reusable.inUse = true;
      reusable.lastUsed = Date.now();
      return reusable.session;
    }

    if (sessionList.length < MAX_CONCURRENT_SESSIONS) {
      const created: SnmpSessionEntry = {
        session: createSnmpSession(ipAddress, port, community, version),
        inUse: true,
        lastUsed: Date.now(),
      };
      sessionList.push(created);
      return created.session;
    }

    await new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_MS));
    return this.getSession(ipAddress, port, community, version);
  }

  releaseSession(session: snmp.Session): void {
    this.sessions.forEach((sessionList) => {
      const found = sessionList.find((entry) => entry.session === session);
      if (found) found.inUse = false;
    });
  }

  cleanup(): void {
    this.sessions.forEach((sessionList) => {
      sessionList.forEach((entry) => closePoolSession(entry.session));
    });
    this.sessions.clear();
  }
}
