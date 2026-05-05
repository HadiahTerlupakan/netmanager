import { logger } from "@/lib/logger";
import { notifyAdminsAboutMobileAction } from "@/modules/notification";

import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type {
  HandleMobileActionInput,
  HandleTaskUpdateInput,
} from "./work-order-mobile-action.types";

const UNKNOWN_USER_NAME = "Unknown";

type WorkOrderDetail = NonNullable<
  Awaited<ReturnType<WorkOrderRepository["findById"]>>
>;

type NotifyMobileTaskUpdateInput = {
  updatedWorkOrder: WorkOrderDetail;
  taskTitle: string | null;
  taskInput: HandleTaskUpdateInput;
};

type NotifyMobileWorkOrderActionInput = {
  workOrder: WorkOrderDetail;
  actionInput: HandleMobileActionInput;
  actorName: string;
};

export async function notifyMobileTaskUpdate(
  input: NotifyMobileTaskUpdateInput,
) {
  await notifyAdminsAboutMobileAction(
    buildTaskUpdateNotificationPayload(input),
  ).catch((error) => logger.error("[TaskNotify] Error:", error));
}

export async function notifyMobileWorkOrderAction(
  input: NotifyMobileWorkOrderActionInput,
) {
  await notifyAdminsAboutMobileAction(
    buildMobileActionNotificationPayload(input),
  );
}

function buildTaskUpdateNotificationPayload(
  input: NotifyMobileTaskUpdateInput,
) {
  return {
    workOrderId: input.taskInput.workOrderId,
    workOrderNumber: input.updatedWorkOrder.workOrderNumber,
    title: input.updatedWorkOrder.title,
    actionType: "NOTE",
    actionMessage: buildTaskActionMessage(
      input.taskInput.isCompleted,
      input.taskTitle,
    ),
    triggeredByUserId: input.taskInput.actor.id,
    triggeredByName: input.taskInput.actor.name || UNKNOWN_USER_NAME,
    ...buildNotificationScope(input.updatedWorkOrder),
  };
}

function buildMobileActionNotificationPayload(
  input: NotifyMobileWorkOrderActionInput,
) {
  return {
    workOrderId: input.actionInput.workOrderId,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    actionType: input.actionInput.payload.action,
    actionMessage: buildMobileActionMessage(input.actionInput),
    triggeredByUserId: input.actionInput.actor.id,
    triggeredByName: input.actorName,
    ...buildNotificationScope(input.workOrder),
  };
}

function buildMobileActionMessage(actionInput: HandleMobileActionInput) {
  return `${actionInput.payload.action} Work Order: ${actionInput.payload.notes || ""}`;
}

function buildNotificationScope(workOrder: WorkOrderDetail) {
  return {
    ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
    ...(workOrder.siteId && { siteId: workOrder.siteId }),
  };
}

function buildTaskActionMessage(
  isCompleted: boolean,
  taskTitle: string | null,
) {
  return isCompleted
    ? `Menyelesaikan task: ${taskTitle || UNKNOWN_USER_NAME}`
    : `Membatalkan task: ${taskTitle || UNKNOWN_USER_NAME}`;
}
