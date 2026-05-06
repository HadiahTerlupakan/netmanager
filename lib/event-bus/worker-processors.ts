import { logger } from "@/lib/logger";
import type { Job } from "bullmq";
import type {
  EventJobData,
  NotificationJobData,
  WebhookJobData,
  OutboxJobData,
  OvertimeAutoCheckoutJobData,
  AttendanceAutoCheckoutJobData,
} from "./queues";
import { getEventHandlers } from "./event-handlers";
import { firebaseRealtimeService } from "@/lib/realtime";
import { EVENT_NAMES } from "./types";

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
// PROCESSING FUNCTIONS
// ============================================

export async function processEventJob(job: Job<EventJobData>): Promise<void> {
  const { eventName } = job.data;
  const handlers = getEventHandlers(eventName);

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

export async function processNotificationJob(
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

export async function processWebhookJob(
  job: Job<WebhookJobData>,
): Promise<void> {
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

export async function processOutboxJob(job: Job<OutboxJobData>): Promise<void> {
  const { outboxEventId, eventName, payload } = job.data;
  logger.info(
    `[Worker] Processing outbox event: ${eventName} (${outboxEventId})`,
  );

  try {
    // Process the event through registered handlers
    const handlers = getEventHandlers(eventName);
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

export async function processOvertimeAutoCheckoutJob(
  job: Job<OvertimeAutoCheckoutJobData>,
): Promise<void> {
  const { OvertimeAutoCheckoutService } = await import("@/modules/overtime");
  await OvertimeAutoCheckoutService.runScheduledAutoCheckout(job.data);
}

export async function processAttendanceAutoCheckoutJob(
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
