import type { RouterOSAPI } from "node-routeros-v2";
import {
  extractSessionUsage,
  normalizeInterfaceName,
  type PPPActiveSessionRecord,
  type SessionUsageData,
} from "./ppp-session-usage";

export type MikroTikSessionUsageDebug = {
  success: boolean;
  routerIpAddress?: string;
  activeSession?: PPPActiveSessionRecord | null;
  interfaceName?: string | null;
  interfacePrint?: PPPActiveSessionRecord | null;
  monitorTraffic?: PPPActiveSessionRecord | null;
  parsedFromActive?: SessionUsageData;
  parsedFromInterface?: SessionUsageData;
  parsedFromMonitor?: SessionUsageData;
  finalUsage?: SessionUsageData;
  interfaceDebug?: {
    rawInterfaceField: string | null;
    rawNameField: string | null;
    candidatesTried: string[];
  };
  monitorError?: string;
  error?: string;
};

export class MikroTikSessionService {
  /** Disconnect all active PPP sessions for a username. */
  async disconnectSession(connection: RouterOSAPI, username: string) {
    const sessions = (await connection.write("/ppp/active/print", [
      `?name=${username}`,
    ])) as Array<Record<string, string>>;
    let disconnected = 0;
    for (const session of sessions || []) {
      if (!session[".id"]) continue;
      await connection.write("/ppp/active/remove", [`=.id=${session[".id"]}`]);
      disconnected++;
    }
    return disconnected;
  }

  /** Collect active session usage and RouterOS lookup diagnostics. */
  async debugActiveSessionUsage(
    connection: RouterOSAPI,
    username: string,
    routerIpAddress: string,
  ): Promise<MikroTikSessionUsageDebug> {
    const sessions = (await connection.write("/ppp/active/print", [
      `?name=${username}`,
    ])) as PPPActiveSessionRecord[];
    const activeSession = sessions?.[0] || null;
    const parsedFromActive = extractSessionUsage(activeSession || undefined);
    const candidateInterfaceNames = this.getInterfaceCandidates(activeSession);
    const interfaceResult = await this.findInterfaceStats(
      connection,
      candidateInterfaceNames,
    );
    const monitorResult = await this.findMonitorTraffic(
      connection,
      candidateInterfaceNames,
    );
    const finalUsage = this.resolveFinalUsage(
      parsedFromActive,
      interfaceResult.parsedFromInterface,
      monitorResult.parsedFromMonitor,
    );

    return {
      success: true,
      routerIpAddress,
      activeSession,
      interfaceName: candidateInterfaceNames[0] || null,
      interfacePrint: interfaceResult.interfacePrint,
      monitorTraffic: monitorResult.monitorTraffic,
      parsedFromActive,
      parsedFromInterface: interfaceResult.parsedFromInterface,
      parsedFromMonitor: monitorResult.parsedFromMonitor,
      finalUsage,
      interfaceDebug: {
        rawInterfaceField: activeSession?.interface || null,
        rawNameField: activeSession?.name || null,
        candidatesTried: candidateInterfaceNames,
      },
      ...this.getMonitorError(
        monitorResult.monitorTraffic,
        candidateInterfaceNames,
      ),
    };
  }

  private getInterfaceCandidates(session: PPPActiveSessionRecord | null) {
    return [
      normalizeInterfaceName(session?.interface),
      normalizeInterfaceName(session?.name),
    ].filter(Boolean);
  }

  private async findInterfaceStats(
    connection: RouterOSAPI,
    candidates: string[],
  ) {
    for (const candidate of candidates) {
      try {
        const stats = (await connection.write("/interface/print", [
          `?name=${candidate}`,
        ])) as PPPActiveSessionRecord[];
        if (!stats?.[0]) continue;
        return {
          interfacePrint: stats[0],
          parsedFromInterface: extractSessionUsage(stats[0]),
        };
      } catch {
        continue;
      }
    }
    return {
      interfacePrint: null,
      parsedFromInterface: undefined,
    };
  }

  private async findMonitorTraffic(
    connection: RouterOSAPI,
    candidates: string[],
  ) {
    for (const candidate of candidates) {
      try {
        const traffic = (await connection.write("/interface/monitor-traffic", [
          `=interface=${candidate}`,
          "=once=",
        ])) as PPPActiveSessionRecord[];
        if (!traffic?.[0]) continue;
        return {
          monitorTraffic: traffic[0],
          parsedFromMonitor: extractSessionUsage(traffic[0]),
        };
      } catch {
        continue;
      }
    }
    return {
      monitorTraffic: null,
      parsedFromMonitor: undefined,
    };
  }

  private resolveFinalUsage(
    activeUsage: SessionUsageData,
    interfaceUsage?: SessionUsageData,
    monitorUsage?: SessionUsageData,
  ) {
    if (this.hasUsage(activeUsage)) return activeUsage;
    if (interfaceUsage && this.hasUsage(interfaceUsage)) return interfaceUsage;
    if (monitorUsage && this.hasUsage(monitorUsage)) return monitorUsage;
    return activeUsage;
  }

  private hasUsage(usage: SessionUsageData) {
    return usage.downloadBytes > 0 || usage.uploadBytes > 0;
  }

  private getMonitorError(
    monitorTraffic: PPPActiveSessionRecord | null,
    candidates: string[],
  ) {
    if (monitorTraffic || candidates.length === 0) return {};
    return {
      monitorError:
        "monitor-traffic lookup failed for all interface candidates",
    };
  }
}
