import { logger } from "@/lib/logger";
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { firebaseRealtimeService } from "@/lib/realtime";
import { getPelangganService } from "@/modules/pelanggan";

import type {
  EventJobData,
  NotificationJobData,
  WebhookJobData,
  OutboxJobData,
  OvertimeAutoCheckoutJobData,
  AttendanceAutoCheckoutJobData,
} from "./queues";
import { QUEUE_NAMES, EVENT_NAMES } from "./types";

const ATTENDANCE_ADMIN_SCOPE = { kind: "admin" as const, id: "notifications" };
const ATTENDANCE_REALTIME_EVENTS = {
  [EVENT_NAMES.ATTENDANCE_CHECKIN]: "attendance.checkin",
  [EVENT_NAMES.ATTENDANCE_ABSENT]: "attendance.absent",
} as const;

function publishAdminAttendanceEvent(
  eventName: keyof typeof ATTENDANCE_REALTIME_EVENTS,
  payload: Record<string, unknown>,
) {
  return firebaseRealtimeService.publish({
    type: ATTENDANCE_REALTIME_EVENTS[eventName],
    scope: ATTENDANCE_ADMIN_SCOPE,
    payload,
  });
}

function publishWebsocketNotification(data: NotificationJobData) {
  if (data.event === "attendance:absent") {
    return publishAdminAttendanceEvent(
      EVENT_NAMES.ATTENDANCE_ABSENT,
      data.data ?? {},
    );
  }

  return null;
}

// ============================================
// REDIS CONNECTION FACTORY
// ============================================

const DEFAULT_LOCAL_REDIS_URL = "redis://localhost:6379";
const REDIS_URL = process.env.REDIS_URL ?? DEFAULT_LOCAL_REDIS_URL;

function createWorkerRedis(): Redis {
  // Parse URL and clean up malformed query params (e.g., ?family=undefined from Next.js env)
  let url = REDIS_URL;
  try {
    const parsed = new URL(REDIS_URL);
    if (parsed.searchParams.has("family")) {
      parsed.searchParams.delete("family");
    }
    // If password is empty string, remove auth part to avoid NOAUTH errors
    if (!parsed.password) {
      parsed.username = "";
    }
    url = parsed.toString().replace(/\?$/, ""); // Remove trailing ? if no params
  } catch {
    // Use URL as-is if parsing fails
  }

  const conn = new Redis(url, {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 10) return null;
      return Math.min(times * 1000, 10000);
    },
    lazyConnect: true,
  });
  conn.on("error", () => {});
  return conn;
}

// ============================================
// EVENT HANDLER REGISTRY
// ============================================

type EventHandlerFn = (job: Job<EventJobData>) => Promise<void>;

const eventHandlers = new Map<string, EventHandlerFn[]>();

/**
 * Register a handler for a specific event name.
 * Multiple handlers can be registered per event.
 */
export function registerEventHandler(
  eventName: string,
  handler: EventHandlerFn,
): void {
  if (!eventHandlers.has(eventName)) {
    eventHandlers.set(eventName, []);
  }
  eventHandlers.get(eventName)!.push(handler);
}

// ============================================
// DEFAULT EVENT HANDLERS
// ============================================

/**
 * Register all default event handlers.
 * These handle the most common cross-module events.
 */
function registerDefaultHandlers(): void {
  // --- BILLING EVENTS ---

  registerEventHandler(EVENT_NAMES.INVOICE_PAID, async (job) => {
    const { payload } = job.data;
    logger.info(
      `[Worker] Invoice paid: ${payload.invoiceId} for customer ${payload.pelangganId}`,
    );

    // Activate customer in main DB when invoice is paid
    try {
      await getPelangganService().updateStatusPelanggan(
        payload.pelangganId,
        "AKTIF",
      );
      logger.info(
        `[Worker] Customer ${payload.pelangganId} activated after payment`,
      );
    } catch (error) {
      logger.error(
        `[Worker] Failed to activate customer ${payload.pelangganId}:`,
        error,
      );
      throw error; // Let BullMQ retry
    }
  });

  // --- NOTIFICATION EVENTS ---

  registerEventHandler(EVENT_NAMES.NOTIFICATION_CREATED, async (job) => {
    const { payload } = job.data;

    // Emit WebSocket notification
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");

      if (payload.userId) {
        socketEmitter.notifyUser(payload.userId, {
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        });
      }

      if (payload.departmentId) {
        socketEmitter.notifyDepartment(payload.departmentId, {
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        });
      }

      if (payload.priority === "HIGH" || payload.priority === "URGENT") {
        socketEmitter.notifyAdmins({
          id: payload.notificationId,
          type: payload.type,
          priority: payload.priority,
          title: payload.title,
          message: payload.message,
          link: payload.link,
          createdAt: payload.timestamp || new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error("[Worker] WebSocket notification error:", error);
    }
  });

  // --- WORK ORDER EVENTS ---

  registerEventHandler(EVENT_NAMES.WORK_ORDER_CREATED, async (job) => {
    const { payload } = job.data;

    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      const { notifyNewWorkOrder } = await import("@/modules/notification");

      // Emit real-time update via Socket.IO
      socketEmitter.newWorkOrder(
        {
          id: payload.workOrderId,
          workOrderNumber: payload.workOrderNumber,
          title: payload.title,
          type: payload.type,
          status: "OPEN",
          priority: payload.priority,
          assignedToId: payload.assignedToId,
          departmentId: payload.departmentId,
        },
        payload.departmentId,
        payload.siteId,
      );

      // Send notifications to eligible users
      await notifyNewWorkOrder({
        workOrderId: payload.workOrderId,
        workOrderNumber: payload.workOrderNumber,
        title: payload.title,
        type: payload.type,
        priority: payload.priority,
        departmentId: payload.departmentId,
        siteId: payload.siteId,
        assignedToId: payload.assignedToId,
        triggeredByUserId: payload.triggeredBy,
      });
    } catch (error) {
      logger.error("[Worker] Work order created handler error:", error);
      throw error;
    }
  });

  registerEventHandler(EVENT_NAMES.WORK_ORDER_ASSIGNED, async (job) => {
    const { payload } = job.data;

    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      const { notifyWorkOrderAssigned } =
        await import("@/modules/notification");

      socketEmitter.workOrderAssigned(
        {
          id: payload.workOrderId,
          workOrderNumber: payload.workOrderNumber,
          title: payload.title,
          type: "WORK_ORDER",
          status: "ASSIGNED",
          priority: "NORMAL",
          assignedToId: payload.assignedToId,
        },
        payload.assignedToId,
      );

      await notifyWorkOrderAssigned({
        workOrderId: payload.workOrderId,
        workOrderNumber: payload.workOrderNumber,
        title: payload.title,
        type: "WORK_ORDER",
        priority: "NORMAL",
        assignedToId: payload.assignedToId,
        assigneeName: payload.assignedToName,
        departmentId: payload.departmentId,
        siteId: payload.siteId,
        triggeredByUserId: payload.triggeredBy,
      });
    } catch (error) {
      logger.error("[Worker] Work order assigned handler error:", error);
      throw error;
    }
  });

  // --- INVENTORY EVENTS ---

  registerEventHandler(EVENT_NAMES.INVENTORY_STOCK_IN, async (job) => {
    const { payload } = job.data;
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.inventoryUpdate({
        type: "masuk",
        userId: payload.userId,
        barangId: payload.barangId,
        jumlah: payload.jumlah,
        totalStok: payload.totalStok,
        gudangId: payload.gudangId,
        siteId: payload.siteId,
      });
    } catch (error) {
      logger.error("[Worker] Inventory stock-in handler error:", error);
    }
  });

  registerEventHandler(EVENT_NAMES.INVENTORY_STOCK_OUT, async (job) => {
    const { payload } = job.data;
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.inventoryUpdate({
        type: "keluar",
        userId: payload.userId,
        barangId: payload.barangId,
        jumlah: payload.jumlah,
        totalStok: payload.totalStok,
        gudangId: payload.gudangId,
        siteId: payload.siteId,
      });
    } catch (error) {
      logger.error("[Worker] Inventory stock-out handler error:", error);
    }
  });

  // --- TICKET EVENTS ---

  registerEventHandler(EVENT_NAMES.TICKET_CREATED, async (job) => {
    const { payload } = job.data;
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.newTicket(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: payload.subject,
          status: "OPEN",
          priority: payload.priority,
          pelangganNama: payload.pelangganNama,
        },
        payload.siteId,
      );
    } catch (error) {
      logger.error("[Worker] Ticket created handler error:", error);
    }
  });

  registerEventHandler(EVENT_NAMES.TICKET_REPLY, async (job) => {
    const { payload } = job.data;
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.ticketReply(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: "",
          status: "",
          priority: "",
        },
        payload.siteId,
        payload.targetUserId,
      );
    } catch (error) {
      logger.error("[Worker] Ticket reply handler error:", error);
    }
  });

  registerEventHandler(EVENT_NAMES.TICKET_STATUS_CHANGED, async (job) => {
    const { payload } = job.data;
    try {
      const { socketEmitter } = await import("@/lib/websocket/emitter");
      socketEmitter.updateTicket(
        {
          id: payload.ticketId,
          ticketNumber: payload.ticketNumber,
          subject: payload.subject,
          status: "UPDATED",
          priority: payload.priority,
        },
        payload.siteId,
      );
    } catch (error) {
      logger.error("[Worker] Ticket status changed handler error:", error);
    }
  });

  // --- ATTENDANCE EVENTS ---

  registerEventHandler(EVENT_NAMES.ATTENDANCE_CHECKIN, async (job) => {
    const { payload } = job.data;
    try {
      await publishAdminAttendanceEvent(EVENT_NAMES.ATTENDANCE_CHECKIN, {
        userId: payload.userId,
        attendanceId: payload.attendanceId,
        timestamp: payload.timestamp,
      });
    } catch (error) {
      logger.error("[Worker] Attendance checkin handler error:", error);
    }
  });

  registerEventHandler(EVENT_NAMES.ATTENDANCE_ABSENT, async (job) => {
    const { payload } = job.data;
    try {
      await publishAdminAttendanceEvent(EVENT_NAMES.ATTENDANCE_ABSENT, {
        userId: payload.userId,
        attendanceId: payload.attendanceId,
        timestamp: payload.timestamp,
      });
    } catch (error) {
      logger.error("[Worker] Attendance absent handler error:", error);
    }
  });

  // --- NETWORK EVENTS ---

  registerEventHandler(EVENT_NAMES.NETWORK_DEVICE_OFFLINE, async (job) => {
    const { payload } = job.data;
    logger.info(
      `[Worker] Network device offline: ${payload.deviceName} (${payload.deviceType})`,
    );
    // Could trigger alerts, auto-ticket creation, etc.
  });
}

// ============================================
// PROCESSING FUNCTIONS
// ============================================

async function processEventJob(job: Job<EventJobData>): Promise<void> {
  const { eventName } = job.data;
  const handlers = eventHandlers.get(eventName);

  if (!handlers || handlers.length === 0) {
    logger.info(`[Worker] No handlers registered for event: ${eventName}`);
    return;
  }

  logger.info(
    `[Worker] Processing event: ${eventName} (handlers: ${handlers.length})`,
  );

  for (const handler of handlers) {
    await handler(job);
  }
}

async function processNotificationJob(
  job: Job<NotificationJobData>,
): Promise<void> {
  const data = job.data;
  logger.info(
    `[Worker] Processing notification: ${data.type} for ${data.userId || data.departmentId || "broadcast"}`,
  );

  switch (data.type) {
    case "expo_push": {
      if (!data.pushToken) break;
      try {
        const { sendPushNotification } = await import("@/modules/notification");
        await sendPushNotification(
          data.pushToken,
          data.title,
          data.body,
          data.data,
        );
      } catch (error) {
        logger.error("[Worker] Expo push failed:", error);
        throw error; // Retry
      }
      break;
    }

    case "websocket": {
      if (!data.room || !data.event) break;
      try {
        const published = publishWebsocketNotification(data);
        if (!published) {
          logger.warn(
            `[Worker] Unsupported websocket notification event: ${data.event}`,
          );
        }
      } catch (error) {
        logger.error("[Worker] WebSocket emit failed:", error);
      }
      break;
    }
  }
}

async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { provider, payload, signature } = job.data;
  logger.info(`[Worker] Processing webhook from: ${provider}`);

  try {
    const { PaymentGatewayManager } = await import("@/modules/finance");
    const { prisma } = await import("@/lib/prisma");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gatewayManager = new PaymentGatewayManager(prisma as any);
    await gatewayManager.processWebhook(provider, payload, signature ?? "");
  } catch (error) {
    logger.error(`[Worker] Webhook processing failed for ${provider}:`, error);
    throw error; // Retry
  }
}

async function processOutboxJob(job: Job<OutboxJobData>): Promise<void> {
  const { outboxEventId, eventName, payload } = job.data;
  logger.info(
    `[Worker] Processing outbox event: ${eventName} (${outboxEventId})`,
  );

  try {
    // Process the event through registered handlers
    const handlers = eventHandlers.get(eventName);
    if (handlers && handlers.length > 0) {
      const mockJob = {
        data: {
          eventName,
          payload,
          category: "outbox",
          timestamp: new Date().toISOString(),
        },
      } as Job<EventJobData>;
      for (const handler of handlers) {
        await handler(mockJob);
      }
    }

    // Mark as processed in outbox
    const { markEventProcessed } = await import("./outbox");
    await markEventProcessed(outboxEventId);
  } catch (error) {
    const { markEventFailed } = await import("./outbox");
    await markEventFailed(
      outboxEventId,
      error instanceof Error ? error.message : String(error),
    );
    throw error; // Let BullMQ retry
  }
}

async function processOvertimeAutoCheckoutJob(
  job: Job<OvertimeAutoCheckoutJobData>,
): Promise<void> {
  const { OvertimeAutoCheckoutService } = await import("@/modules/overtime");
  await OvertimeAutoCheckoutService.runScheduledAutoCheckout(job.data);
}

async function processAttendanceAutoCheckoutJob(
  job: Job<AttendanceAutoCheckoutJobData>,
): Promise<void> {
  const { AutoCheckoutService } = await import("@/modules/attendance");
  await AutoCheckoutService.runAutoCheckoutJob(job.data);
}

export async function rehydrateOvertimeAutoCheckoutJobs(): Promise<void> {
  try {
    const { rehydrateOvertimeAutoCheckoutJobs: rehydrateJobs } =
      await import("@/modules/overtime");
    await rehydrateJobs();
  } catch (error) {
    if (isMissingOvertimeAutoCheckoutScheduleTable(error)) {
      logger.warn(
        "[EventBus] Skipping overtime auto checkout rehydration because database migration is pending",
      );
      return;
    }

    throw error;
  }
}

function isMissingOvertimeAutoCheckoutScheduleTable(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error as Error & { code?: string }).code === "P2021"
  );
}

// ============================================
// WORKER INSTANCES
// ============================================

let workers: Worker[] = [];
let _handlersRegistered = false;

export async function dispatchEventForTest(
  eventName: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!_handlersRegistered) {
    registerDefaultHandlers();
    _handlersRegistered = true;
  }

  const handlers = eventHandlers.get(eventName);
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

  // Event Worker
  const eventWorker = new Worker<EventJobData>(
    QUEUE_NAMES.EVENTS,
    processEventJob,
    {
      connection: connection.duplicate(),
      concurrency: 10,
      limiter: { max: 100, duration: 1000 }, // 100 jobs/sec
    },
  );

  // Notification Worker
  const notificationWorker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    processNotificationJob,
    {
      connection: connection.duplicate(),
      concurrency: 20,
      limiter: { max: 50, duration: 1000 }, // 50 notifications/sec
    },
  );

  // Webhook Worker
  const webhookWorker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOKS,
    processWebhookJob,
    {
      connection: connection.duplicate(),
      concurrency: 5,
    },
  );

  // Outbox Worker
  const outboxWorker = new Worker<OutboxJobData>(
    QUEUE_NAMES.OUTBOX,
    processOutboxJob,
    {
      connection: connection.duplicate(),
      concurrency: 5,
    },
  );

  // Overtime Auto Checkout Worker
  const overtimeAutoCheckoutWorker = new Worker<OvertimeAutoCheckoutJobData>(
    QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT,
    processOvertimeAutoCheckoutJob,
    {
      connection: connection.duplicate(),
      concurrency: 5,
    },
  );

  const attendanceAutoCheckoutWorker =
    new Worker<AttendanceAutoCheckoutJobData>(
      QUEUE_NAMES.ATTENDANCE_AUTO_CHECKOUT,
      processAttendanceAutoCheckoutJob,
      {
        connection: connection.duplicate(),
        concurrency: 5,
      },
    );

  workers = [
    eventWorker,
    notificationWorker,
    webhookWorker,
    outboxWorker,
    overtimeAutoCheckoutWorker,
    attendanceAutoCheckoutWorker,
  ];

  // Event listeners for monitoring
  for (const worker of workers) {
    worker.on("completed", (job) => {
      logger.info(`[BullMQ] ${worker.name}: Job ${job.id} completed`);
    });

    worker.on("failed", (job, err) => {
      logger.error(
        `[BullMQ] ${worker.name}: Job ${job?.id} failed:`,
        err.message,
      );
    });

    worker.on("error", (err) => {
      logger.error(`[BullMQ] ${worker.name}: Worker error:`, err.message);
    });
  }

  logger.info("[BullMQ] All workers started");
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
 * Get worker health status
 */
export function getWorkerStatus(): Array<{ name: string; isRunning: boolean }> {
  return workers.map((w) => ({
    name: w.name,
    isRunning: !w.closing,
  }));
}
