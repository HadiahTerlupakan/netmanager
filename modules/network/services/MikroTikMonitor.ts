import { logger } from "@/lib/logger";
import { checkAllMikroTikRouterStatus } from "./mikrotik-ping-check";
import { firebaseRealtimeService } from "@/lib/realtime";
import { MikroTikRouterRepository } from "@/modules/network/repositories/MikroTikRouterRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";

class MikroTikMonitor {
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private readonly CHECK_INTERVAL = 60000 * 5;
  private errorCount: number = 0;
  private readonly MAX_ERRORS = 5;
  private networkRepo: NetworkRepository;

  constructor() {
    this.networkRepo = new NetworkRepository();
  }

  public setSocketServer(_io?: unknown) {}

  public start() {
    if (this.intervalId) {
      return;
    }

    this.errorCount = 0;
    this.checkStatus();
    this.scheduleNext();
  }

  public stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  private scheduleNext() {
    const backoff =
      this.errorCount > 2 ? Math.min(2 ** (this.errorCount - 2), 8) : 1;
    const interval = this.CHECK_INTERVAL * backoff;

    this.intervalId = setTimeout(() => {
      this.checkStatus().then(() => {
        if (this.intervalId) this.scheduleNext();
      });
    }, interval);
  }

  private isConnectionError(error: unknown): boolean {
    if (error && typeof error === "object") {
      const code = (error as { code?: string }).code;
      const message = (error as { message?: string }).message || "";
      return (
        code === "ECONNREFUSED" ||
        code === "ENOTFOUND" ||
        code === "ETIMEDOUT" ||
        message.includes("ECONNREFUSED") ||
        message.includes("Connection refused")
      );
    }
    return false;
  }

  private async checkStatus() {
    try {
      const scope = { kind: "admin", id: "mikrotik" } as const;
      const updatedCount = await checkAllMikroTikRouterStatus();

      const routerRepository = new MikroTikRouterRepository();

      const tenants = await this.networkRepo.findActiveTenants();

      for (const tenant of tenants) {
        try {
          const stats = await routerRepository.getStatistics(tenant.id);
          await firebaseRealtimeService.publish({
            type: "mikrotik.update",
            scope,
            payload: stats,
          });
        } catch (e) {
          logger.error(
            `[MikroTikMonitor] Error getting stats for tenant ${tenant.id}:`,
            e,
          );
        }
      }

      this.errorCount = 0;

      await firebaseRealtimeService.publish({
        type: "mikrotik.update",
        scope,
        payload: {
          timestamp: new Date(),
          updatedCount,
        },
      });
    } catch (error: unknown) {
      this.errorCount++;

      if (this.isConnectionError(error)) {
        const code = (error as { code?: string }).code || "ECONNREFUSED";
        logger.warn(
          `[MikroTikMonitor] DB connection failed (${code}) - attempt ${this.errorCount}/${this.MAX_ERRORS}`,
        );
      } else {
        logger.error(
          `[MikroTikMonitor] Error (${this.errorCount}/${this.MAX_ERRORS}):`,
          error instanceof Error ? error.message : error,
        );
      }

      if (this.errorCount >= this.MAX_ERRORS) {
        logger.error(
          "[MikroTikMonitor] Stopping after too many consecutive failures",
        );
        this.stop();
      }
    }
  }
}

export const mikroTikMonitor = new MikroTikMonitor();
