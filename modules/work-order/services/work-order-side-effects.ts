import { logger, logActivitySafe } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { WorkOrderEventDispatcher } from "@/modules/events";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";
import { randomUUID } from "crypto";

import type {
  WorkOrderPriority,
  WorkOrderStatus,
} from "../types/work-order.enums";
import type { TicketRepository } from "../repositories/WorkOrderSupportRepositories";
import { workOrderCacheService } from "./WorkOrderCacheService";
import {
  onWorkOrderCreated,
  onWorkOrderStatusChanged,
} from "./WorkOrderNotifications";
import {
  buildNotificationPayload,
  buildTicketReplyMessage,
  publishCompletedStatusEvent,
  publishUpdatedStatusEvent,
} from "./work-order-side-effects.helpers";
import {
  buildMaterialReturnActivityEntry,
  type MaterialReturnActivityInput,
} from "./work-order-material-return-activity";

const COMPLETED_STATUS = "COMPLETED";

export type MobileWorkOrderMaterialNotificationInput = {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  actionType: string;
  actionMessage: string;
  triggeredByUserId: string;
  triggeredByName?: string;
  departmentId?: string;
  siteId?: string;
};

type WorkOrderNotificationPayload = {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string | null;
  siteId?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
};

type WorkOrderCreatedPayload = WorkOrderNotificationPayload & {
  status: string;
  createdAt: Date;
};

type WorkOrderTicketPayload = {
  workOrderNumber: string;
  title: string;
  type: string;
  scheduledDate?: Date | string | null;
};

/** Notify listeners about created work order without breaking the request flow. */
export async function notifyWorkOrderCreatedSafely(
  workOrder: WorkOrderNotificationPayload,
  triggeredByUserId?: string,
): Promise<void> {
  try {
    await onWorkOrderCreated(
      buildNotificationPayload(workOrder),
      triggeredByUserId,
    );
  } catch (err) {
    logger.error(
      "Failed to send work order notification",
      err instanceof Error ? err : undefined,
    );
  }
}

/** Publish work order created domain event. */
export async function publishWorkOrderCreatedEvent(params: {
  workOrder: WorkOrderNotificationPayload;
  triggeredBy: string;
  tenantId?: string;
}): Promise<void> {
  await publishWorkOrderEvent("WORK_ORDER_CREATED", () =>
    WorkOrderEventDispatcher.onCreated(
      buildCreatedWorkOrderEventPayload(params),
    ),
  );
}

function buildCreatedWorkOrderEventPayload(input: {
  workOrder: WorkOrderNotificationPayload;
  triggeredBy: string;
  tenantId?: string;
}) {
  return {
    workOrderId: input.workOrder.id,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    type: input.workOrder.type,
    priority: input.workOrder.priority,
    departmentId: input.workOrder.departmentId,
    siteId: input.workOrder.siteId,
    assignedToId: input.workOrder.assignedToId,
    tenantId: input.tenantId,
    triggeredBy: input.triggeredBy,
  };
}

/** Broadcast created work order to websocket clients. */
export function broadcastWorkOrderCreatedSafely(
  workOrder: WorkOrderCreatedPayload,
): void {
  try {
    socketEmitter.newWorkOrder(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        status: workOrder.status as WorkOrderStatus,
        priority: workOrder.priority as WorkOrderPriority,
        departmentId: workOrder.departmentId || undefined,
        assignedToId: workOrder.assignedToId || undefined,
        createdAt: workOrder.createdAt.toISOString(),
      },
      workOrder.departmentId || undefined,
    );
  } catch (err) {
    logger.error(
      "Failed to broadcast work order event",
      err instanceof Error ? err : undefined,
    );
  }
}

/** Link created work order back to source ticket safely. */
export async function linkWorkOrderToTicketSafely(params: {
  ticketRepo: TicketRepository;
  workOrder: WorkOrderTicketPayload;
  ticketId: string;
  userId: string;
}): Promise<void> {
  try {
    await createTicketReplyAndStartTicket(params);
  } catch (err) {
    logger.error(
      "Failed to link work order to ticket",
      err instanceof Error ? err : undefined,
    );
  }
}

async function createTicketReplyAndStartTicket(input: {
  ticketRepo: TicketRepository;
  workOrder: WorkOrderTicketPayload;
  ticketId: string;
  userId: string;
}) {
  await input.ticketRepo.createReply({
    id: randomUUID(),
    ticketId: input.ticketId,
    message: buildTicketReplyMessage(input.workOrder),
    isFromAdmin: true,
    senderId: input.userId,
  });
  await input.ticketRepo.updateTicketStatus(input.ticketId, "IN_PROGRESS");
}

/** Publish notification and event side effects for status updates. */
export async function publishWorkOrderStatusSideEffects(params: {
  workOrder: WorkOrderNotificationPayload;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
  tenantId?: string;
}): Promise<void> {
  await notifyWorkOrderStatusChange(params);
  await publishWorkOrderStatusEvent(params);
}

async function notifyWorkOrderStatusChange(input: {
  workOrder: WorkOrderNotificationPayload;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
  tenantId?: string;
}) {
  await onWorkOrderStatusChanged(
    buildNotificationPayload(input.workOrder),
    input.previousStatus,
    input.status,
    input.userId,
  );
}

async function publishWorkOrderStatusEvent(input: {
  workOrder: WorkOrderNotificationPayload;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
  tenantId?: string;
}) {
  if (input.status === COMPLETED_STATUS) {
    await publishCompletedStatusEvent(input.workOrder, input.userId);
    return;
  }

  await publishUpdatedStatusEvent(input);
}

/** Publish notification and event side effects for assignments. */
export async function publishWorkOrderAssignmentSideEffects(params: {
  workOrder: WorkOrderNotificationPayload;
  employeeId: string;
  employeeName?: string;
  assignedById: string;
  tenantId?: string;
}): Promise<void> {
  // Notifikasi penugasan dikirim oleh handler `WORK_ORDER_ASSIGNED`
  // (`lib/event-bus/event-handlers.ts`). Memanggil `onWorkOrderAssigned` di
  // sini membuat `notifyWorkOrderAssigned` berjalan dua kali untuk satu
  // penugasan — dua baris notifikasi dan dua push ke karyawan yang sama.
  await publishWorkOrderEvent("WORK_ORDER_ASSIGNED", () =>
    WorkOrderEventDispatcher.onAssigned(
      buildAssignedWorkOrderEventPayload(params),
    ),
  );
}

function buildAssignedWorkOrderEventPayload(input: {
  workOrder: WorkOrderNotificationPayload;
  employeeId: string;
  employeeName?: string;
  assignedById: string;
  tenantId?: string;
}) {
  return {
    workOrderId: input.workOrder.id,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    assignedToId: input.employeeId,
    assignedToName: input.employeeName,
    departmentId: input.workOrder.departmentId,
    siteId: input.workOrder.siteId,
    tenantId: input.tenantId,
    triggeredBy: input.assignedById,
  };
}

/** Write work order activity log safely. */
export function logWorkOrderActivity(
  action: string,
  subject: string,
  userId: string,
  details: Record<string, unknown>,
): void {
  logActivitySafe({ action, subject, userId, details });
}

/** Invalidate all cached work-order views. */
export async function invalidateWorkOrderCaches(): Promise<void> {
  await workOrderCacheService.invalidateAllCaches();
}

/** Notify admins about mobile material actions without failing workflow. */
export async function notifyMobileWorkOrderMaterialActionSafely(
  input: MobileWorkOrderMaterialNotificationInput,
): Promise<void> {
  try {
    await notifyAdminsAboutMobileAction(input);
  } catch (err) {
    logger.error(
      "Failed to notify admins about mobile material action",
      err instanceof Error ? err : undefined,
    );
  }
}

/** Log mobile material return activity. */
export function logMobileMaterialReturnActivity(
  input: MaterialReturnActivityInput,
): void {
  logActivitySafe(buildMaterialReturnActivityEntry(input));
}

async function publishWorkOrderEvent(
  eventName: string,
  publish: () => Promise<void>,
): Promise<void> {
  await publish().catch((err) =>
    logger.error(
      `Failed to publish ${eventName} event`,
      err instanceof Error ? err : undefined,
    ),
  );
}

/** Reuse mobile material action notifier for return flow. */
export async function notifyMobileWorkOrderMaterialReturnSafely(
  input: MobileWorkOrderMaterialNotificationInput,
): Promise<void> {
  await notifyMobileWorkOrderMaterialActionSafely(input);
}
