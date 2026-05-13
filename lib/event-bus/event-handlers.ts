import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import { getPelangganService } from "@/modules/pelanggan";
import type { Job } from "bullmq";
import type { EventJobData } from "./queues";
import { EVENT_NAMES } from "./types";
import { handleCustomerStatusEvent } from "@/modules/network/services/event-handlers/customer-status.handler";
import { handleInvoiceAutoIsolate } from "@/modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler";

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

// ============================================
// EVENT HANDLER REGISTRY
// ============================================

export type EventHandlerFn = (job: Job<EventJobData>) => Promise<void>;

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

/**
 * Get all registered handlers for an event.
 */
export function getEventHandlers(eventName: string): EventHandlerFn[] {
  return eventHandlers.get(eventName) ?? [];
}

// ============================================
// DEFAULT EVENT HANDLERS
// ============================================

/**
 * Register all default event handlers.
 * These handle the most common cross-module events.
 */
export function registerDefaultHandlers(): void {
  // --- BILLING EVENTS ---

  registerEventHandler(
    EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
    handleInvoiceAutoIsolate,
  );

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

  // --- CUSTOMER LIFECYCLE EVENTS (sync MikroTik/RADIUS) ---

  registerEventHandler(EVENT_NAMES.CUSTOMER_CREATED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_UPDATED, handleCustomerStatusEvent);
  registerEventHandler(
    EVENT_NAMES.CUSTOMER_SUSPENDED,
    handleCustomerStatusEvent,
  );
  registerEventHandler(
    EVENT_NAMES.CUSTOMER_ACTIVATED,
    handleCustomerStatusEvent,
  );
  registerEventHandler(
    EVENT_NAMES.CUSTOMER_ISOLATED,
    handleCustomerStatusEvent,
  );
  registerEventHandler(EVENT_NAMES.CUSTOMER_DELETED, handleCustomerStatusEvent);

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
          assignedToId: payload.assignedToId ?? null,
          departmentId: payload.departmentId ?? null,
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
          assignedToId: payload.assignedToId ?? null,
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
        barangId: payload.barangId ?? undefined,
        jumlah: payload.jumlah ?? undefined,
        totalStok: payload.totalStok ?? undefined,
        gudangId: payload.gudangId ?? undefined,
        siteId: payload.siteId ?? undefined,
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
        barangId: payload.barangId ?? undefined,
        jumlah: payload.jumlah ?? undefined,
        totalStok: payload.totalStok ?? undefined,
        gudangId: payload.gudangId ?? undefined,
        siteId: payload.siteId ?? undefined,
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
          pelangganNama: payload.pelangganNama ?? undefined,
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
