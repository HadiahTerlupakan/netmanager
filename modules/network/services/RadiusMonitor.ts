import { firebaseRealtimeService } from "@/lib/realtime";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { BaseMonitor } from "./BaseMonitor";
import { NetworkRepository } from "../repositories/NetworkRepository";

const POLL_INTERVAL = 30 * 1000;

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
    const tenants = await this.networkRepo.findActiveTenants();

    for (const tenant of tenants) {
      try {
        const scope = { kind: "admin", id: `radius:${tenant.id}` } as const;
        const hasActiveConsumers =
          await firebaseRealtimeService.hasActiveScopeConsumers(scope);

        if (!hasActiveConsumers) {
          continue;
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
        console.error(
          `[RadiusMonitor] Error polling for tenant ${tenant.id}:`,
          error,
        );
      }
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
