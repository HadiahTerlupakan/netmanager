import { logger } from "@/lib/logger";
import { WorkOrderEventDispatcher } from "@/modules/events";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import type { WorkOrderStatus } from "../types/work-order.enums";

export function buildNotificationPayload<
  T extends {
    id: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
  },
>(workOrder: T) {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    type: workOrder.type,
    priority: workOrder.priority,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
  };
}

export function buildTicketReplyMessage(workOrder: {
  workOrderNumber: string;
  title: string;
  type: string;
  scheduledDate?: Date | string | null;
}) {
  const scheduledTime = workOrder.scheduledDate
    ? format(new Date(workOrder.scheduledDate), "dd MMMM yyyy HH:mm", {
        locale: localeId,
      })
    : "Belum Dijadwalkan";

  return (
    `Work Order #${workOrder.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
    `Judul: ${workOrder.title}\n` +
    `Tipe: ${workOrder.type}\n` +
    `Jadwal: ${scheduledTime}`
  );
}

export async function publishCompletedStatusEvent(
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
  },
  userId: string,
) {
  await publishWorkOrderEvent("WORK_ORDER_COMPLETED", () =>
    WorkOrderEventDispatcher.onCompleted(
      buildCompletedStatusEventPayload(workOrder, userId),
    ),
  );
}

export async function publishUpdatedStatusEvent(input: {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
  };
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}) {
  await publishWorkOrderEvent("WORK_ORDER_UPDATED", () =>
    WorkOrderEventDispatcher.onUpdated(buildUpdatedStatusEventPayload(input)),
  );
}

function buildCompletedStatusEventPayload(
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
  },
  userId: string,
) {
  return {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
    triggeredBy: userId,
  };
}

function buildUpdatedStatusEventPayload(input: {
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
  };
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}) {
  return {
    ...buildUpdatedStatusWorkOrderFields(input.workOrder),
    updateMessage: buildStatusChangeMessage(input),
    triggeredBy: input.userId,
  };
}

function buildUpdatedStatusWorkOrderFields(workOrder: {
  id: string;
  workOrderNumber: string;
  title: string;
  departmentId?: string | null;
  siteId?: string | null;
  assignedToId?: string | null;
}) {
  return {
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    departmentId: workOrder.departmentId,
    siteId: workOrder.siteId,
    assignedToId: workOrder.assignedToId,
  };
}

function buildStatusChangeMessage(input: {
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
}) {
  return `Status changed from ${input.previousStatus} to ${input.status}`;
}

async function publishWorkOrderEvent(
  eventName: string,
  publish: () => Promise<void>,
) {
  await publish().catch((err) =>
    logger.error(
      `Failed to publish ${eventName} event`,
      err instanceof Error ? err : undefined,
    ),
  );
}
