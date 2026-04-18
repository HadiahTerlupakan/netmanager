import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { acquireCronLock } from "@/lib/cron-lock";

export async function canRunCronJob(
  jobName: string,
  ttlSeconds: number,
): Promise<boolean> {
  const lockResult = await acquireCronLock(jobName, ttlSeconds);
  return lockResult === "acquired";
}

export class CronRegistry {
  private tasks: Map<string, ScheduledTask> = new Map();

  public startAll() {
    console.log("[CronRegistry] Starting all cron jobs...");

    // Start Automatic Billing Service (Daily at 01:00 AM)
    import("../modules/finance/services/AutomaticBillingService")
      .then(({ AutomaticBillingService }) => {
        const billingCronTask = cron.schedule("0 1 * * *", async () => {
          if (!(await canRunCronJob("billing", 82800))) return;
          console.log("[Cron] Running daily billing check");
          AutomaticBillingService.generateDailyInvoices();
        });
        this.tasks.set("billing", billingCronTask);
        console.log("[CronRegistry] Automatic billing cron scheduled");

        const reminderCronTask = cron.schedule("* * * * *", async () => {
          if (!(await canRunCronJob("reminder", 55))) return;
          AutomaticBillingService.sendDailyReminders();
        });
        this.tasks.set("reminder", reminderCronTask);
        console.log(
          "[CronRegistry] Automatic reminder check cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Automatic Billing Service:",
          err,
        ),
      );

    // Start Automatic Isolation Service (Daily at 00:00 AM)
    import("../modules/finance/services/AutomaticIsolationService")
      .then(({ AutomaticIsolationService }) => {
        const isolationTask = cron.schedule("0 0 * * *", async () => {
          if (!(await canRunCronJob("isolation", 82800))) return;
          console.log("[Cron] Running daily isolation check");
          AutomaticIsolationService.runDailyCheck();
        });
        this.tasks.set("isolation", isolationTask);
        console.log(
          "[CronRegistry] Automatic isolation cron scheduled (00:00)",
        );
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Automatic Isolation Service:",
          err,
        ),
      );

    // Start Auto Checkout Service (Daily at 23:59)
    import("../modules/attendance/services/AutoCheckoutService")
      .then(({ AutoCheckoutService }) => {
        const autoCheckoutTask = cron.schedule("59 23 * * *", async () => {
          if (!(await canRunCronJob("autoCheckout", 82800))) return;
          console.log("[Cron] Running daily auto-checkout");
          AutoCheckoutService.runAutoCheckout();
        });
        this.tasks.set("autoCheckout", autoCheckoutTask);
        console.log("[CronRegistry] Auto checkout cron scheduled (23:59)");
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Auto Checkout Service:",
          err,
        ),
      );

    // Start Overtime Auto Checkout Service (Every minute)
    import("../modules/overtime/services/OvertimeAutoCheckoutService")
      .then(({ OvertimeAutoCheckoutService }) => {
        const overtimeAutoCheckoutTask = cron.schedule(
          "* * * * *",
          async () => {
            if (!(await canRunCronJob("overtimeAutoCheckout", 55))) return;
            console.log("[Cron] Running overtime auto-checkout");
            OvertimeAutoCheckoutService.runAutoCheckout().catch((err) =>
              console.error("[Cron] Overtime auto-checkout failed:", err),
            );
          },
        );
        this.tasks.set("overtimeAutoCheckout", overtimeAutoCheckoutTask);
        console.log(
          "[CronRegistry] Overtime auto checkout cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Overtime Auto Checkout Service:",
          err,
        ),
      );

    // Start Location Cleanup Service (Daily at 02:00 AM)
    import("../modules/attendance/services/LocationTrackingService")
      .then(({ LocationTrackingService }) => {
        const locationCleanupTask = cron.schedule("0 2 * * *", async () => {
          if (!(await canRunCronJob("locationCleanup", 82800))) return;
          console.log("[Cron] Running daily location cleanup");
          const service = new LocationTrackingService();
          service
            .cleanupOldLocations()
            .catch((err) =>
              console.error("[Cron] Location cleanup failed:", err),
            );
        });
        this.tasks.set("locationCleanup", locationCleanupTask);
        console.log("[CronRegistry] Location cleanup cron scheduled (02:00)");
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Location Tracking Service for cleanup:",
          err,
        ),
      );

    // Start Monthly Asset Depreciation Service (Monthly on 1st at 02:00 AM)
    import("../modules/inventory/services/AssetService")
      .then(({ AssetService }) => {
        const assetDepreciationTask = cron.schedule("0 2 1 * *", async () => {
          if (!(await canRunCronJob("assetDepreciation", 2505600))) return;
          console.log("[Cron] Running monthly asset depreciation");
          try {
            const { prisma } = await import("./prisma");
            const systemUser =
              (await prisma.user.findFirst({
                where: { role: { name: "SUPER_ADMIN" } },
              })) || (await prisma.user.findFirst());

            if (systemUser) {
              const assetService = new AssetService();
              const results = await assetService.runMonthlyDepreciationCycle(
                systemUser.id,
              );
              console.log(
                `[Cron] Depreciation complete. Processed ${results.length} assets.`,
              );
            } else {
              console.error(
                "[Cron] Failed to run depreciation: No system user found",
              );
            }
          } catch (err) {
            console.error("[Cron] Depreciation cycle failed:", err);
          }
        });
        this.tasks.set("assetDepreciation", assetDepreciationTask);
        console.log(
          "[CronRegistry] Asset depreciation cron scheduled (Monthly 1st 02:00)",
        );
      })
      .catch((err) =>
        console.error("[CronRegistry] Failed to start Asset Service:", err),
      );

    // Start MixRadius Invoice Sync Service (Hourly at minute 0)
    import("../modules/integrations/services/MixRadiusSyncService")
      .then(({ syncService }) => {
        const mixRadiusInvoiceTask = cron.schedule("0 * * * *", async () => {
          if (!(await canRunCronJob("mixRadiusInvoiceSync", 3540))) return;
          console.log("[Cron] Running hourly MixRadius invoice sync");
          syncService.syncInvoices();
        });
        this.tasks.set("mixRadiusInvoiceSync", mixRadiusInvoiceTask);
        console.log(
          "[CronRegistry] MixRadius invoice sync cron scheduled (Hourly)",
        );

        const mixRadiusSettlementTask = cron.schedule("5 0 * * *", async () => {
          if (!(await canRunCronJob("mixRadiusSettlementSync", 82800))) return;
          console.log("[Cron] Running daily MixRadius settlement sync (T-1)");
          syncService.syncYesterdaySettlement();
        });
        this.tasks.set("mixRadiusSettlementSync", mixRadiusSettlementTask);
        console.log(
          "[CronRegistry] MixRadius settlement sync cron scheduled (00:05)",
        );
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start MixRadius Sync Service:",
          err,
        ),
      );

    // Start RAB Status Evaluation Service (Daily at 01:00 AM)
    const rabStatusTask = cron.schedule("0 1 * * *", async () => {
      if (!(await canRunCronJob("rabStatusEvaluation", 82800))) return;
      console.log("[Cron] Running daily RAB status evaluation");
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
        console.log("[Cron] RAB status evaluation result:", data);
      } catch (err) {
        console.error("[Cron] Failed to run RAB status evaluation:", err);
      }
    });
    this.tasks.set("rabStatusEvaluation", rabStatusTask);
    console.log("[CronRegistry] RAB status evaluation cron scheduled (01:00)");
  }

  public stopAll() {
    console.log(`[CronRegistry] Stopping ${this.tasks.size} cron jobs...`);
    for (const [name, task] of this.tasks.entries()) {
      task.stop();
      console.log(`[CronRegistry] Stopped task: ${name}`);
    }
    this.tasks.clear();
  }
}

export const cronRegistry = new CronRegistry();
