import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { BaseMonitor } from "./BaseMonitor";
import { NetworkRepository } from "../repositories/NetworkRepository";

// Reduced from 30s to 5min to avoid Firestore quota exhaustion
// At 30s: 2880 writes/day per tenant (2 writes × 2880 polls)
// At 5min: 576 writes/day per tenant (2 writes × 288 polls)
const POLL_INTERVAL = 5 * 60 * 1000;

export class RadiusMonitor extends BaseMonitor {
  private repository: RadiusRepository;
  private networkRepo: NetworkRepository;

  constructor(_io?: unknown) {
    super();
    this.repository = new RadiusRepository();
    this.networkRepo = new NetworkRepository();
  }

  protected override getMonitorName(): string {
    return "RadiusMonitor";
  }

  protected override getPollInterval(): number {
    return POLL_INTERVAL;
  }

  protected override async poll(): Promise<void> {
    const tenants = await runAsSystemContext(
      "RadiusMonitor: discover active tenants",
      () => this.networkRepo.findActiveTenants(),
    );

    for (const tenant of tenants) {
      await runWithRequestTenantContext(
        { tenantId: tenant.id, isSuperAdmin: false },
        async () => {
          try {
            const scope = { kind: "admin", id: `radius:${tenant.id}` } as const;

            // Check if there are active consumers before publishing
            // This prevents unnecessary Firestore writes when no one is listening
            const hasConsumers =
              await firebaseRealtimeService.hasActiveScopeConsumers(scope);

            if (!hasConsumers) {
              return;
            }

            const [stats, recentSessions] = await Promise.all([
              this.repository.getDashboardStats(tenant.id),
              this.repository.getRecentSessions(tenant.id, {
                limit: 50,
                status: "active",
              }),
            ]);

            await firebaseRealtimeService.publish({
              type: "radius.stats",
              scope,
              payload: stats,
            });
            await firebaseRealtimeService.publish({
              type: "radius.sessions",
              scope,
              payload: recentSessions,
            });
          } catch (error) {
            logger.error(
              `[RadiusMonitor] Error polling for tenant ${tenant.id}:`,
              error,
            );
          }
        },
      );
    }
  }
}

let monitorInstance: RadiusMonitor | null = null;

export function startRadiusMonitoring() {
  if (!monitorInstance) {
    monitorInstance = new RadiusMonitor();
    monitorInstance.start();
  }
  return monitorInstance;
}

export function stopRadiusMonitoring() {
  if (monitorInstance) {
    monitorInstance.stop();
    monitorInstance = null;
  }
}
