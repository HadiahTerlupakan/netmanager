import { logger } from "@/lib/logger";
import { shutdownManager } from "@/lib/shutdown-manager";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { Worker, type Job, type Processor } from "bullmq";
import type {
  EventJobData,
  NotificationJobData,
  WebhookJobData,
  OutboxJobData,
  OvertimeAutoCheckoutJobData,
  AttendanceAutoCheckoutJobData,
  BillingScheduleJobData,
} from "./queues";
import { QUEUE_NAMES } from "./types";
import { createWorkerRedis } from "./redis-connection";
import {
  registerDefaultHandlers,
  registerEventHandler,
  getEventHandlers,
} from "./event-handlers";
import {
  processEventJob,
  processNotificationJob,
  processWebhookJob,
  processOutboxJob,
  processOvertimeAutoCheckoutJob,
  processAttendanceAutoCheckoutJob,
  processBillingScheduleJob,
  rehydrateOvertimeAutoCheckoutJobs,
  rehydrateBillingScheduleJobs,
} from "./worker-processors";

/**
 * Wrap BullMQ processor agar setiap job berjalan dalam tenant context yang
 * benar. Why: worker dijalankan di custom server tanpa request context;
 * tanpa pembungkus ini Prisma extension menolak akses (fail-closed) atau —
 * sebelum perbaikan ini — diam-diam berjalan sebagai super admin lintas tenant.
 * How to apply: payload event yang membawa tenantId dipakai sebagai konteks
 * tenant; jika tidak ada, fallback ke system context (untuk job yang memang
 * cross-tenant seperti outbox dispatch).
 */
function withTenantContext<T>(
  processorName: string,
  processor: Processor<T>,
): Processor<T> {
  return async (job: Job<T>) => {
    const data = job.data as { payload?: { tenantId?: string } } | undefined;
    const tenantId = data?.payload?.tenantId;
    if (tenantId) {
      return runWithRequestTenantContext(
        { tenantId, isSuperAdmin: false },
        () => processor(job),
      );
    }
    return runAsSystemContext(`bullmq:${processorName}:${job.name}`, () =>
      processor(job),
    );
  };
}

// Re-export for backward compatibility
export {
  registerEventHandler,
  rehydrateOvertimeAutoCheckoutJobs,
  rehydrateBillingScheduleJobs,
};

// ============================================
// WORKER INSTANCES
// ============================================

let workers: Worker[] = [];
let _handlersRegistered = false;

/**
 * Dispatch event for testing purposes.
 * Used by test suites to trigger event handlers without BullMQ.
 */
export async function dispatchEventForTest(
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!_handlersRegistered) {
    registerDefaultHandlers();
    _handlersRegistered = true;
  }

  const handlers = getEventHandlers(eventName);
  if (!handlers || handlers.length === 0) {
    return;
  }

  const mockJob = {
    data: {
      eventName,
      payload,
      category: "test",
      timestamp: new Date().toISOString(),
    },
  } as Job<EventJobData>;

  for (const handler of handlers) {
    await handler(mockJob);
  }
}

/**
 * Start all BullMQ workers.
 * Call this once during application startup.
 */
export function startWorkers(): void {
  if (!_handlersRegistered) {
    registerDefaultHandlers();
    _handlersRegistered = true;
  }

  const connection = createWorkerRedis();

  // Wait for Redis connection to be ready before creating workers
  connection.once("ready", () => {
    logger.info("[Redis] Connection ready, starting workers...");

    // Event Worker
    const eventWorker = new Worker<EventJobData>(
      QUEUE_NAMES.EVENTS,
      withTenantContext("eventWorker", processEventJob),
      {
        connection: connection.duplicate(),
        concurrency: 10,
        limiter: { max: 100, duration: 1000 }, // 100 jobs/sec
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    // Notification Worker
    const notificationWorker = new Worker<NotificationJobData>(
      QUEUE_NAMES.NOTIFICATIONS,
      withTenantContext("notificationWorker", processNotificationJob),
      {
        connection: connection.duplicate(),
        concurrency: 20,
        limiter: { max: 50, duration: 1000 }, // 50 notifications/sec
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    // Webhook Worker
    const webhookWorker = new Worker<WebhookJobData>(
      QUEUE_NAMES.WEBHOOKS,
      withTenantContext("webhookWorker", processWebhookJob),
      {
        connection: connection.duplicate(),
        concurrency: 5,
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    // Outbox Worker
    const outboxWorker = new Worker<OutboxJobData>(
      QUEUE_NAMES.OUTBOX,
      withTenantContext("outboxWorker", processOutboxJob),
      {
        connection: connection.duplicate(),
        concurrency: 5,
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    // Overtime Auto Checkout Worker
    const overtimeAutoCheckoutWorker = new Worker<OvertimeAutoCheckoutJobData>(
      QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT,
      withTenantContext(
        "overtimeAutoCheckoutWorker",
        processOvertimeAutoCheckoutJob,
      ),
      {
        connection: connection.duplicate(),
        concurrency: 5,
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    // Attendance Auto Checkout Worker
    const attendanceAutoCheckoutWorker =
      new Worker<AttendanceAutoCheckoutJobData>(
        QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT,
        withTenantContext(
          "attendanceAutoCheckoutWorker",
          processAttendanceAutoCheckoutJob,
        ),
        {
          connection: connection.duplicate(),
          concurrency: 5,
          autorun: true,
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      );

    // Billing Schedule Worker
    const billingScheduleWorker = new Worker<BillingScheduleJobData>(
      QUEUE_NAMES.BILLING_SCHEDULE,
      withTenantContext("billingScheduleWorker", processBillingScheduleJob),
      {
        connection: connection.duplicate(),
        concurrency: 5,
        autorun: true,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    workers = [
      eventWorker,
      notificationWorker,
      webhookWorker,
      outboxWorker,
      overtimeAutoCheckoutWorker,
      attendanceAutoCheckoutWorker,
      billingScheduleWorker,
    ];

    // Event listeners for monitoring
    for (const worker of workers) {
      worker.on("completed", (job) => {
        logger.debug(`[BullMQ] ${worker.name}: Job ${job.id} completed`);
      });

      worker.on("failed", (job, err) => {
        logger.error(
          `[BullMQ] ${worker.name}: Job ${job?.id} failed:`,
          err.message,
        );
      });

      worker.on("error", (err) => {
        // Filter out noise from Redis timeout and connection errors
        const ignoredErrors = [
          "Stream isn't writeable",
          "Command timed out",
          "Connection is closed",
          "ETIMEDOUT",
        ];

        if (!ignoredErrors.some((msg) => err.message.includes(msg))) {
          logger.error(`[BullMQ] ${worker.name}: Worker error:`, err.message);
        }
      });

      worker.on("stalled", (jobId) => {
        logger.warn(`[BullMQ] ${worker.name}: Job ${jobId} stalled`);
      });

      worker.on("active", (job) => {
        logger.debug(`[BullMQ] ${worker.name}: Job ${job.id} started`);
      });
    }

    // Register graceful shutdown
    shutdownManager.register(async () => {
      logger.info("[BullMQ] Shutting down workers gracefully...");
      await Promise.all(workers.map((w) => w.close()));
      await connection.quit();
      logger.info("[BullMQ] All workers shut down");
    });

    logger.info("[BullMQ] All workers started");
  });

  connection.once("error", (err) => {
    logger.error(
      "[Redis] Failed to connect, workers not started:",
      err.message,
    );
  });
}

/**
 * Stop all BullMQ workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  const stopPromises = workers.map((worker) => worker.close());
  await Promise.allSettled(stopPromises);
  workers = [];
  logger.info("[BullMQ] All workers stopped");
}

/**
 * Get worker health status.
 */
export function getWorkerStatus(): Array<{ name: string; isRunning: boolean }> {
  return workers.map((w) => ({
    name: w.name,
    isRunning: !w.closing,
  }));
}
