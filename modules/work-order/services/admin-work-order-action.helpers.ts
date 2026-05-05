import { logger } from "@/lib/logger";

import type { ServiceResult, UserContext } from "./WorkOrderService";

const WORK_ORDER_REMINDER_STATUSES = [
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;

export type WorkOrderRequestAction = "APPROVE" | "REJECT";

type WorkOrderRequestActionService = {
  approveRequest: (
    workOrderId: string,
    userContext: UserContext,
  ) => Promise<ServiceResult<unknown>>;
  rejectRequest: (
    workOrderId: string,
    userContext: UserContext,
    reason: string,
  ) => Promise<ServiceResult<unknown>>;
};

type ExecuteRequestApprovalActionInput = {
  workOrderService: WorkOrderRequestActionService;
  workOrderId: string;
  action: WorkOrderRequestAction;
  userContext: UserContext;
  reason?: string;
};

export function executeRequestApprovalAction(
  input: ExecuteRequestApprovalActionInput,
): Promise<ServiceResult<unknown>> {
  if (input.action === "APPROVE") {
    return input.workOrderService.approveRequest(
      input.workOrderId,
      input.userContext,
    );
  }

  return input.workOrderService.rejectRequest(
    input.workOrderId,
    input.userContext,
    input.reason || "",
  );
}

export function logCommentCreated(input: {
  workOrderId: string;
  message: string;
  actorId: string;
  truncateMessage: (message: string) => string;
}) {
  return logger.logActivity({
    action: "CREATE",
    subject: "Work Order Comment",
    details: {
      workOrderId: input.workOrderId,
      message: input.truncateMessage(input.message),
    },
    userId: input.actorId,
  });
}

export function logTaskCreated(input: {
  workOrderId: string;
  actorId: string;
  task: { id: string; title: string; order: number };
}) {
  return logger.logActivity({
    action: "CREATE",
    subject: "Work Order Task",
    details: {
      workOrderId: input.workOrderId,
      taskId: input.task.id,
      taskTitle: input.task.title,
      order: input.task.order,
    },
    userId: input.actorId,
  });
}

export function canSendWorkOrderReminder(status: string) {
  return (WORK_ORDER_REMINDER_STATUSES as readonly string[]).includes(status);
}
