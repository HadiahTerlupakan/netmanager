import { logger } from "@/lib/logger";
import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { acquireCronLock } from "@/lib/cron-lock";
import { runAsSystemContext } from "@/lib/tenant-context";

export async function canRunCronJob(
  jobName: string,
  ttlSeconds: number,
): Promise<boolean> {
  const lockResult = await acquireCronLock(jobName, ttlSeconds);
  return lockResult === "acquired";
}

/**
 * Bungkus body cron job dengan elevasi konteks sistem.
 * Why: cron berjalan di custom server tanpa request context. Tanpa elevasi
 * eksplisit, Prisma extension menolak query (fail-closed) — ini disengaja
 * untuk mencegah handler lain ikut terbypass.
 * How to apply: pakai untuk setiap callback `cron.schedule(...)` yang butuh
 * akses lintas-tenant (batch billing, sync, monitoring).
 */
function runCronTask(
  jobName: string,
  body: () => Promise<unknown> | unknown,
): Promise<void> {
  return runAsSystemContext(`cron:${jobName}`, async () => {
    await body();
  });
}

export class CronRegistry {
  private tasks: Map<string, ScheduledTask> = new Map();

  public startAll() {
    logger.info("[CronRegistry] Starting all cron jobs...");

    // Start Automatic Billing Service (Daily at 01:00 AM)
    import("../modules/finance")
      .then(({ AutomaticBillingService }) => {
        const billingCronTask = cron.schedule("0 1 * * *", async () => {
          if (!(await canRunCronJob("billing", 82800))) return;
          logger.info("[Cron] Running daily billing check");
          await runCronTask("billing", () =>
            AutomaticBillingService.generateDailyInvoices(),
          );
        });
        this.tasks.set("billing", billingCronTask);
        logger.info("[CronRegistry] Automatic billing cron scheduled");

        const reminderCronTask = cron.schedule("* * * * *", async () => {
          if (!(await canRunCronJob("reminder", 55))) return;
          await runCronTask("reminder", () =>
            AutomaticBillingService.sendDailyReminders(),
          );
        });
        this.tasks.set("reminder", reminderCronTask);
        logger.info(
          "[CronRegistry] Automatic reminder check cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start Automatic Billing Service:",
          err,
        ),
      );

    // Start Billing Schedule Reconciliation (Every minute)
    import("../modules/finance")
      .then(({ AutomaticIsolationService }) => {
        const isolationTask = cron.schedule("* * * * *", async () => {
          if (
            !(await canRunCronJob("route:billingScheduleReconciliation", 55))
          ) {
            return;
          }
          logger.info("[Cron] Running billing schedule reconciliation");
          await runCronTask("billingScheduleReconciliation", () =>
            AutomaticIsolationService.runDailyCheck(),
          );
        });
        this.tasks.set("billingScheduleReconciliation", isolationTask);
        logger.info(
          "[CronRegistry] Billing schedule reconciliation cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start Automatic Isolation Service:",
          err,
        ),
      );

    // Start Attendance Orchestrator (Every minute)
    import("../modules/attendance")
      .then(({ runAttendanceCronOrchestrator }) => {
        const attendanceOrchestratorTask = cron.schedule(
          "* * * * *",
          async () => {
            if (!(await canRunCronJob("attendanceOrchestrator", 55))) return;
            logger.info("[Cron] Running attendance orchestrator");
            await runCronTask("attendanceOrchestrator", async () => {
              await runAttendanceCronOrchestrator();
            });
          },
        );
        this.tasks.set("attendanceOrchestrator", attendanceOrchestratorTask);
        logger.info(
          "[CronRegistry] Attendance orchestrator cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start AttendanceCronOrchestratorService:",
          err,
        ),
      );

    // Start Location Cleanup Service (Daily at 02:00 AM)
    import("../modules/attendance")
      .then(({ LocationTrackingService }) => {
        const locationCleanupTask = cron.schedule("0 2 * * *", async () => {
          if (!(await canRunCronJob("locationCleanup", 82800))) return;
          logger.info("[Cron] Running daily location cleanup");
          await runCronTask("locationCleanup", async () => {
            const service = new LocationTrackingService();
            try {
              await service.cleanupOldLocations();
            } catch (err) {
              logger.error("[Cron] Location cleanup failed:", err);
            }
          });
        });
        this.tasks.set("locationCleanup", locationCleanupTask);
        logger.info("[CronRegistry] Location cleanup cron scheduled (02:00)");
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start Location Tracking Service for cleanup:",
          err,
        ),
      );

    // Start Monthly Asset Depreciation Service (Monthly on 1st at 02:00 AM)
    import("../modules/inventory")
      .then(({ AssetService }) => {
        const assetDepreciationTask = cron.schedule("0 2 1 * *", async () => {
          if (!(await canRunCronJob("assetDepreciation", 2505600))) return;
          logger.info("[Cron] Running monthly asset depreciation");
          await runCronTask("assetDepreciation", async () => {
            try {
              const { prisma } = await import("./prisma");
              const systemUser =
                (await prisma.user.findFirst({
                  where: { role: { isSuperAdmin: true } },
                })) || (await prisma.user.findFirst());

              if (systemUser) {
                const assetService = new AssetService();
                const results = await assetService.runMonthlyDepreciationCycle(
                  systemUser.id,
                );
                logger.info(
                  `[Cron] Depreciation complete. Processed ${results.length} assets.`,
                );
              } else {
                logger.error(
                  "[Cron] Failed to run depreciation: No system user found",
                );
              }
            } catch (err) {
              logger.error("[Cron] Depreciation cycle failed:", err);
            }
          });
        });
        this.tasks.set("assetDepreciation", assetDepreciationTask);
        logger.info(
          "[CronRegistry] Asset depreciation cron scheduled (Monthly 1st 02:00)",
        );
      })
      .catch((err) =>
        logger.error("[CronRegistry] Failed to start Asset Service:", err),
      );

    // Start MixRadius Invoice Sync Service (Hourly at minute 0)
    import("../modules/integrations")
      .then(({ getMixRadiusSyncService }) => {
        const mixRadiusInvoiceTask = cron.schedule("0 * * * *", async () => {
          if (!(await canRunCronJob("mixRadiusInvoiceSync", 3540))) return;
          logger.info("[Cron] Running hourly MixRadius invoice sync");
          await runCronTask("mixRadiusInvoiceSync", () =>
            getMixRadiusSyncService().syncInvoices(),
          );
        });
        this.tasks.set("mixRadiusInvoiceSync", mixRadiusInvoiceTask);
        logger.info(
          "[CronRegistry] MixRadius invoice sync cron scheduled (Hourly)",
        );

        const mixRadiusSettlementTask = cron.schedule("5 0 * * *", async () => {
          if (!(await canRunCronJob("mixRadiusSettlementSync", 82800))) return;
          logger.info("[Cron] Running daily MixRadius settlement sync (T-1)");
          await runCronTask("mixRadiusSettlementSync", () =>
            getMixRadiusSyncService().syncYesterdaySettlement(),
          );
        });
        this.tasks.set("mixRadiusSettlementSync", mixRadiusSettlementTask);
        logger.info(
          "[CronRegistry] MixRadius settlement sync cron scheduled (00:05)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start MixRadius Sync Service:",
          err,
        ),
      );

    // Start RAB Status Evaluation Service (Daily at 01:00 AM)
    const rabStatusTask = cron.schedule("0 1 * * *", async () => {
      if (!(await canRunCronJob("rabStatusEvaluation", 82800))) return;
      logger.info("[Cron] Running daily RAB status evaluation");
      try {
        const port = process.env.PORT || "3000";
        const res = await fetch(
          `http://localhost:${port}/api/cron/rab-status-eval`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`,
            },
          },
        );
        const data = await res.json();
        logger.info("[Cron] RAB status evaluation result:", data);
      } catch (err) {
        logger.error("[Cron] Failed to run RAB status evaluation:", err);
      }
    });
    this.tasks.set("rabStatusEvaluation", rabStatusTask);
    logger.info("[CronRegistry] RAB status evaluation cron scheduled (01:00)");

    // Start Pending Package Applier (Daily at 00:05 AM — sebelum billing cycle lain)
    import("../modules/finance")
      .then(({ PendingPackageApplierService }) => {
        const pendingPackageTask = cron.schedule("5 0 * * *", async () => {
          if (!(await canRunCronJob("route:applyPendingPackages", 82800)))
            return;
          logger.info("[Cron] Running daily pending package applier");
          await runCronTask("applyPendingPackages", async () => {
            try {
              await new PendingPackageApplierService().applyDuePending();
            } catch (err) {
              logger.error("[Cron] Pending package applier failed:", err);
            }
          });
        });
        this.tasks.set("applyPendingPackages", pendingPackageTask);
        logger.info(
          "[CronRegistry] Pending package applier cron scheduled (00:05)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start PendingPackageApplierService:",
          err,
        ),
      );

    // Start OLT Monitoring Service (Every 5 minutes)
    import("../modules/olt")
      .then(({ OnuMonitoringService }) => {
        const monitoringService = new OnuMonitoringService();
        const oltMonitoringTask = cron.schedule("*/5 * * * *", async () => {
          if (!(await canRunCronJob("oltMonitoring", 280))) return;
          logger.info("[Cron] Running OLT monitoring poll");
          try {
            const { prisma } = await import("../modules/database");
            const { runWithRequestTenantContext } =
              await import("./tenant-context");
            const tenants = await runAsSystemContext(
              "oltMonitoring: discover tenants",
              () => prisma.tenant.findMany({ select: { id: true } }),
            );
            for (const tenant of tenants) {
              await runWithRequestTenantContext(
                { tenantId: tenant.id, isSuperAdmin: false },
                () => monitoringService.pollAllOlts(tenant.id),
              );
            }
          } catch (err) {
            logger.error("[Cron] OLT monitoring failed:", err);
          }
        });
        this.tasks.set("oltMonitoring", oltMonitoringTask);
        logger.info(
          "[CronRegistry] OLT monitoring cron scheduled (Every 5 minutes)",
        );
      })
      .catch((err) =>
        logger.error(
          "[CronRegistry] Failed to start OnuMonitoringService:",
          err,
        ),
      );

    // Start Accel-PPP Health Check (Every minute)
    import("../modules/network")
      .then(({ AccelPppMonitor }) => {
        const accelPppMonitorTask = cron.schedule("* * * * *", async () => {
          if (!(await canRunCronJob("accelPppHealthCheck", 55))) return;
          await runCronTask("accelPppHealthCheck", async () => {
            try {
              await new AccelPppMonitor().checkAll();
            } catch (err) {
              logger.error("[Cron] Accel-PPP health check failed:", err);
            }
          });
        });
        this.tasks.set("accelPppHealthCheck", accelPppMonitorTask);
        logger.info(
          "[CronRegistry] Accel-PPP health check cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        logger.error("[CronRegistry] Failed to start Accel-PPP Monitor:", err),
      );
  }

  public stopAll() {
    logger.info(`[CronRegistry] Stopping ${this.tasks.size} cron jobs...`);
    for (const [name, task] of this.tasks.entries()) {
      task.stop();
      logger.info(`[CronRegistry] Stopped task: ${name}`);
    }
    this.tasks.clear();
  }
}

export const cronRegistry = new CronRegistry();
