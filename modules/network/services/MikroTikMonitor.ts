import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import type {
  RealtimeEventType,
  RealtimeScope,
} from "@/lib/realtime/contracts";
import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";
import { NetworkRepository } from "../repositories/NetworkRepository";
import { checkAllMikroTikRouterStatus } from "./mikrotik-ping-check";

const ROUTER_CHECK_INTERVAL_MS = 60000 * 5;
const MAX_CONSECUTIVE_ERRORS = 5;
const INITIAL_BACKOFF_THRESHOLD = 2;
const MAX_BACKOFF_MULTIPLIER = 8;
const REALTIME_SCOPE = {
  kind: "admin",
  id: "mikrotik",
} satisfies RealtimeScope;
const REALTIME_EVENT_TYPE = "mikrotik.update" satisfies RealtimeEventType;

interface ActiveTenantRecord {
  id: string;
}

interface RouterStatsRepository {
  getStatistics(tenantId: string): Promise<unknown>;
}

interface TenantRepository {
  findActiveTenants(): Promise<ActiveTenantRecord[]>;
}

interface RealtimePublisher {
  publish(payload: {
    type: RealtimeEventType;
    scope: RealtimeScope;
    payload: unknown;
  }): Promise<unknown>;
}

function calculateBackoffMultiplier(errorCount: number): number {
  if (errorCount <= INITIAL_BACKOFF_THRESHOLD) {
    return 1;
  }

  return Math.min(
    2 ** (errorCount - INITIAL_BACKOFF_THRESHOLD),
    MAX_BACKOFF_MULTIPLIER,
  );
}

function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorCode = (error as { code?: string }).code;
  const errorMessage = (error as { message?: string }).message || "";

  return (
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "ETIMEDOUT" ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("Connection refused")
  );
}

async function publishTenantStats(
  tenantRepository: TenantRepository,
  statsRepository: RouterStatsRepository,
  publisher: RealtimePublisher,
) {
  const tenants = await runAsSystemContext(
    "MikroTikMonitor: discover active tenants",
    () => tenantRepository.findActiveTenants(),
  );

  for (const tenant of tenants) {
    await runWithRequestTenantContext(
      { tenantId: tenant.id, isSuperAdmin: false },
      async () => {
        try {
          const stats = await statsRepository.getStatistics(tenant.id);
          await publisher.publish({
            type: REALTIME_EVENT_TYPE,
            scope: REALTIME_SCOPE,
            payload: stats,
          });
        } catch (error) {
          logger.error(
            `[MikroTikMonitor] Error getting stats for tenant ${tenant.id}:`,
            error,
          );
        }
      },
    );
  }
}

async function publishUpdatedCount(
  publisher: RealtimePublisher,
  updatedCount: number,
) {
  await publisher.publish({
    type: REALTIME_EVENT_TYPE,
    scope: REALTIME_SCOPE,
    payload: {
      timestamp: new Date(),
      updatedCount,
    },
  });
}

function logMonitorError(error: unknown, errorCount: number) {
  if (isConnectionError(error)) {
    const errorCode = (error as { code?: string }).code || "ECONNREFUSED";
    logger.warn(
      `[MikroTikMonitor] DB connection failed (${errorCode}) - attempt ${errorCount}/${MAX_CONSECUTIVE_ERRORS}`,
    );
    return;
  }

  logger.error(
    `[MikroTikMonitor] Error (${errorCount}/${MAX_CONSECUTIVE_ERRORS}):`,
    error instanceof Error ? error.message : error,
  );
}

/** Monitor status router MikroTik dan publikasikan statistik realtime. */
class MikroTikMonitor {
  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private errorCount = 0;
  private readonly tenantRepository: TenantRepository;
  private readonly statsRepository: RouterStatsRepository;
  private readonly publisher: RealtimePublisher;

  constructor() {
    this.tenantRepository = new NetworkRepository();
    this.statsRepository = new MikroTikRouterRepository();
    this.publisher = firebaseRealtimeService;
  }

  /** Set socket server placeholder untuk kompatibilitas lama. */
  public setSocketServer(_io?: unknown) {}

  /** Mulai loop monitoring router. */
  public start() {
    if (this.intervalId) {
      return;
    }

    this.errorCount = 0;
    void this.checkStatus();
  }

  /** Hentikan loop monitoring router. */
  public stop() {
    if (!this.intervalId) {
      return;
    }

    clearTimeout(this.intervalId);
    this.intervalId = null;
  }

  private scheduleNext() {
    const interval =
      ROUTER_CHECK_INTERVAL_MS * calculateBackoffMultiplier(this.errorCount);

    this.intervalId = setTimeout(() => {
      void this.checkStatus();
    }, interval);
  }

  public async checkStatus() {
    try {
      const updatedCount = await checkAllMikroTikRouterStatus();
      await publishTenantStats(
        this.tenantRepository,
        this.statsRepository,
        this.publisher,
      );
      await publishUpdatedCount(this.publisher, updatedCount);
      this.errorCount = 0;
    } catch (error) {
      this.errorCount += 1;
      logMonitorError(error, this.errorCount);

      if (this.errorCount >= MAX_CONSECUTIVE_ERRORS) {
        logger.error(
          "[MikroTikMonitor] Stopping after too many consecutive failures",
        );
        this.stop();
        return;
      }
    }

    this.scheduleNext();
  }
}

export const mikroTikMonitor = new MikroTikMonitor();
