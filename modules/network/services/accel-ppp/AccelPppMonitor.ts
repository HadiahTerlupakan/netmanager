import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { AccelPppServerRepository } from "../../repositories/AccelPppServerRepository";
import type { IAccelPppServerRepository } from "../../domain/ports/IAccelPppServerRepository";
import type { AccelPppServerEntity } from "../../domain/entities/AccelPppServerEntity";
import { AccelPppCliClient } from "./AccelPppCliClient";

export interface AccelPppMonitorCliFactory {
  (server: AccelPppServerEntity): Pick<AccelPppCliClient, "showStat">;
}

const defaultCliFactory: AccelPppMonitorCliFactory = (server) =>
  new AccelPppCliClient({
    host: server.cliHost,
    port: server.cliPort,
    password: server.cliPassword,
    timeoutMs: 4000,
  });

export interface AccelPppMonitorRunResult {
  total: number;
  online: number;
  offline: number;
  errors: number;
}

/**
 * Periodic health check untuk seluruh accel-ppp server.
 *
 * Why: dashboard admin perlu data fresh tentang ping status & jumlah
 * user online tanpa harus polling CLI per request. Monitor ini run lewat
 * cron-registry tiap 60 detik dan persist hasilnya ke field
 * `pingStatus`/`userOnline`/`lastStatusCheck`.
 *
 * Implementasi:
 *   - `Promise.allSettled` per server → 1 server hang/timeout tidak ganggu lain.
 *   - Tidak melakukan ICMP ping; CLI `show stat` sudah jadi proxy paling kuat
 *     untuk liveness (kalau CLI nyala = service hidup).
 *   - Multi-tenant aware: scoping per tenant lewat `runWithRequestTenantContext`
 *     supaya Prisma extension fail-closed tetap pass.
 */
export class AccelPppMonitor {
  constructor(
    private readonly serverRepo: IAccelPppServerRepository = new AccelPppServerRepository(),
    private readonly cliFactory: AccelPppMonitorCliFactory = defaultCliFactory,
  ) {}

  /**
   * Cek semua server lintas tenant. Return statistik agregat
   * (total/online/offline/errors) untuk telemetry/log.
   */
  async checkAll(): Promise<AccelPppMonitorRunResult> {
    const servers = await runAsSystemContext(
      "AccelPppMonitor: discover servers",
      () => this.serverRepo.findAllForMonitor(),
    );

    if (servers.length === 0) {
      return { total: 0, online: 0, offline: 0, errors: 0 };
    }

    const results = await Promise.allSettled(
      servers.map((server) => this.checkOne(server)),
    );

    let online = 0;
    let offline = 0;
    let errors = 0;

    for (const result of results) {
      if (result.status === "rejected") {
        errors += 1;
        continue;
      }
      if (result.value === "online") online += 1;
      else offline += 1;
    }

    logger.info("[accel-ppp-monitor] cycle complete", {
      total: servers.length,
      online,
      offline,
      errors,
    });

    return { total: servers.length, online, offline, errors };
  }

  /**
   * Cek satu server. Tidak throw — selalu update DB sesuai hasil.
   * Return ringkas status untuk agregasi caller.
   */
  private async checkOne(
    server: AccelPppServerEntity,
  ): Promise<"online" | "offline"> {
    const tenantId = server.tenantId ?? null;
    const cli = this.cliFactory(server);
    const checkedAt = new Date();

    const updateStatus = (status: "online" | "offline", userOnline: number) =>
      runWithRequestTenantContext(
        { tenantId: tenantId ?? "", isSuperAdmin: false },
        () =>
          this.serverRepo.updateStatus(server.id, {
            pingStatus: status,
            userOnline,
            lastStatusCheck: checkedAt,
          }),
      );

    try {
      const stat = await cli.showStat();
      await updateStatus("online", stat.activeSessions);
      return "online";
    } catch (error) {
      logger.warn("[accel-ppp-monitor] server offline", {
        serverId: server.id,
        ipAddress: server.ipAddress,
        error: (error as Error).message,
      });
      await updateStatus("offline", 0);
      return "offline";
    }
  }
}
