import { logger } from "@/lib/logger";
import { randomUUID } from "crypto";

import type { WorkOrderPriority, WorkOrderStatus } from "@prisma/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { logActivitySafe } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { WorkOrderEventDispatcher } from "@/modules/events";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";

import type { TicketRepository } from "../repositories/WorkOrderSupportRepositories";

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
import { workOrderCacheService } from "./WorkOrderCacheService";
import {
  onWorkOrderAssigned,
  onWorkOrderCreated,
  onWorkOrderStatusChanged,
} from "./WorkOrderNotifications";

type WorkOrderNotificationPayload = {
  id: string;
  workOrderNumber: string;
  title: string;
  type: string;
  priority: string;
  departmentId?: string | null;
  siteId?: string | null;
  assignedToId?: string | null;
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

export async function notifyWorkOrderCreatedSafely(
  workOrder: WorkOrderNotificationPayload,
  triggeredByUserId?: string,
): Promise<void> {
  try {
    await onWorkOrderCreated(
      {
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        type: workOrder.type,
        priority: workOrder.priority,
        departmentId: workOrder.departmentId,
        siteId: workOrder.siteId,
        assignedToId: workOrder.assignedToId,
      },
      triggeredByUserId,
    );
  } catch (err) {
    logger.error(
      "Failed to send work order notification",
      err instanceof Error ? err : undefined,
    );
  }
}

export async function publishWorkOrderCreatedEvent(params: {
  workOrder: WorkOrderNotificationPayload;
  triggeredBy: string;
}): Promise<void> {
  const { workOrder, triggeredBy } = params;

  await WorkOrderEventDispatcher.onCreated({
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    type: workOrder.type,
    priority: workOrder.priority,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
    triggeredBy,
  }).catch((err) =>
    logger.error(
      "Failed to publish WORK_ORDER_CREATED event",
      err instanceof Error ? err : undefined,
    ),
  );
}

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

export async function linkWorkOrderToTicketSafely(params: {
  ticketRepo: TicketRepository;
  workOrder: WorkOrderTicketPayload;
  ticketId: string;
  userId: string;
}): Promise<void> {
  const { ticketRepo, workOrder, ticketId, userId } = params;

  try {
    const scheduledTime = workOrder.scheduledDate
      ? format(new Date(workOrder.scheduledDate), "dd MMMM yyyy HH:mm", {
          locale: localeId,
        })
      : "Belum Dijadwalkan";

    const replyMessage =
      `Work Order #${workOrder.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
      `Judul: ${workOrder.title}\n` +
      `Tipe: ${workOrder.type}\n` +
      `Jadwal: ${scheduledTime}`;

    await ticketRepo.createReply({
      id: randomUUID(),
      ticketId,
      message: replyMessage,
      isFromAdmin: true,
      senderId: userId,
    });

    await ticketRepo.updateTicketStatus(ticketId, "IN_PROGRESS");
  } catch (err) {
    logger.error(
      "Failed to link work order to ticket",
      err instanceof Error ? err : undefined,
    );
  }
}

export async function publishWorkOrderStatusSideEffects(params: {
  workOrder: WorkOrderNotificationPayload;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}): Promise<void> {
  const { workOrder, previousStatus, status, userId } = params;

  await onWorkOrderStatusChanged(
    {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      departmentId: workOrder.departmentId,
      siteId: workOrder.siteId,
      assignedToId: workOrder.assignedToId,
    },
    previousStatus,
    status,
    userId,
  );

  if (status === "COMPLETED") {
    await WorkOrderEventDispatcher.onCompleted({
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      departmentId: workOrder.departmentId,
      siteId: workOrder.siteId,
      assignedToId: workOrder.assignedToId,
      triggeredBy: userId,
    }).catch((err) =>
      logger.error(
        "Failed to publish WORK_ORDER_COMPLETED event",
        err instanceof Error ? err : undefined,
      ),
    );

    return;
  }

  await WorkOrderEventDispatcher.onUpdated({
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    updateMessage: `Status changed from ${previousStatus} to ${status}`,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
    triggeredBy: userId,
  }).catch((err) =>
    logger.error(
      "Failed to publish WORK_ORDER_UPDATED event",
      err instanceof Error ? err : undefined,
    ),
  );
}

export async function publishWorkOrderAssignmentSideEffects(params: {
  workOrder: WorkOrderNotificationPayload;
  employeeId: string;
  employeeName?: string;
  assignedById: string;
}): Promise<void> {
  const { workOrder, employeeId, employeeName, assignedById } = params;

  await onWorkOrderAssigned(
    {
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      type: workOrder.type,
      priority: workOrder.priority,
      departmentId: workOrder.departmentId,
      siteId: workOrder.siteId,
      assignedToId: workOrder.assignedToId,
    },
    undefined,
    assignedById,
  );

  await WorkOrderEventDispatcher.onAssigned({
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    assignedToId: employeeId,
    assignedToName: employeeName,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    triggeredBy: assignedById,
  }).catch((err) =>
    logger.error(
      "Failed to publish WORK_ORDER_ASSIGNED event",
      err instanceof Error ? err : undefined,
    ),
  );
}

export function logWorkOrderActivity(
  action: string,
  subject: string,
  userId: string,
  details: Record<string, unknown>,
): void {
  logActivitySafe({ action, subject, userId, details });
}

export async function invalidateWorkOrderCaches(): Promise<void> {
  await workOrderCacheService.invalidateAllCaches();
}

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

export function logMobileMaterialReturnActivity(input: {
  userId: string;
  tenantId?: string;
  workOrderId: string;
  workOrderNumber: string;
  items: Array<{
    id: string;
    nama: string;
    jumlah: number;
    satuan: string;
    kondisi: string;
    barangId: string;
    gudangId: string;
  }>;
}): void {
  const { userId, tenantId, workOrderId, workOrderNumber, items } = input;

  logActivitySafe({
    action: "CREATE",
    subject: "MaterialReturn",
    userId,
    ...(tenantId ? { tenantId } : {}),
    details: {
      workOrderId,
      workOrderNumber,
      items,
    },
  });
}

export async function notifyMobileWorkOrderMaterialReturnSafely(
  input: MobileWorkOrderMaterialNotificationInput,
): Promise<void> {
  await notifyMobileWorkOrderMaterialActionSafely(input);
}
