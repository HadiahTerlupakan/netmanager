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

export async function notifyMobileTaskUpdate(input: {
  updatedWorkOrder: WorkOrderDetail;
  taskTitle: string | null;
  taskInput: HandleTaskUpdateInput;
}) {
  await notifyAdminsAboutMobileAction({
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
    ...(input.updatedWorkOrder.departmentId && {
      departmentId: input.updatedWorkOrder.departmentId,
    }),
    ...(input.updatedWorkOrder.siteId && {
      siteId: input.updatedWorkOrder.siteId,
    }),
  }).catch((error) => logger.error("[TaskNotify] Error:", error));
}

export async function notifyMobileWorkOrderAction(input: {
  workOrder: WorkOrderDetail;
  actionInput: HandleMobileActionInput;
  actorName: string;
}) {
  await notifyAdminsAboutMobileAction({
    workOrderId: input.actionInput.workOrderId,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    actionType: input.actionInput.payload.action,
    actionMessage: `${input.actionInput.payload.action} Work Order: ${input.actionInput.payload.notes || ""}`,
    triggeredByUserId: input.actionInput.actor.id,
    triggeredByName: input.actorName,
    ...(input.workOrder.departmentId && {
      departmentId: input.workOrder.departmentId,
    }),
    ...(input.workOrder.siteId && { siteId: input.workOrder.siteId }),
  });
}

function buildTaskActionMessage(
  isCompleted: boolean,
  taskTitle: string | null,
) {
  return isCompleted
    ? `Menyelesaikan task: ${taskTitle || UNKNOWN_USER_NAME}`
    : `Membatalkan task: ${taskTitle || UNKNOWN_USER_NAME}`;
}
