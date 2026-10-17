import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { validateWorkOrderAccess as validateWorkOrderAccessHelper } from "./work-order-access";
import {
  createWorkOrderMutationErrorResult,
  persistRequestDecision,
  validateRequestState,
} from "./work-order-mutation.helpers";
import {
  createWorkOrderNotFoundResult,
  isWorkOrderNotFoundError,
  logWorkOrderServiceError,
} from "./work-order-service-helpers";
import { ensureWorkOrderExists } from "./work-order-service-guards";
import type {
  ServiceResult,
  UserContext,
} from "./work-order-service.contracts";
import { invalidateWorkOrderCaches } from "./work-order-side-effects";
import {
  recordWorkOrderActivity,
  WORK_ORDER_ACTIVITY_ACTIONS,
  type WorkOrderActivityTarget,
} from "./work-order-activity-log";

type AccessibleRepository = Pick<WorkOrderRepository, "findById">;
type RequestRepository = Pick<
  WorkOrderRepository,
  "findById" | "approveRequest" | "rejectRequest"
>;

export async function getAccessibleWorkOrder(params: {
  repository: AccessibleRepository;
  id: string;
  userContext: UserContext;
}): Promise<ServiceResult<WorkOrderWithRelations>> {
  const workOrder = await validateWorkOrderAccessHelper({
    repository: params.repository,
    workOrderId: params.id,
    userContext: params.userContext,
  });

  const missingResult = ensureWorkOrderExists(workOrder);
  if (missingResult) return missingResult;
  return { success: true, data: workOrder };
}

export async function findSuccessResult(params: {
  repository: AccessibleRepository;
  id: string;
}): Promise<ServiceResult<WorkOrderWithRelations>> {
  const workOrder = await params.repository.findById(params.id);
  return { success: true, data: workOrder as WorkOrderWithRelations };
}

export function handleMutationError<T>(params: {
  message: string;
  error: unknown;
  fallback: string;
  code: string;
}): ServiceResult<T> {
  logWorkOrderServiceError(params.message, params.error);
  if (isWorkOrderNotFoundError(params.error)) {
    return createWorkOrderNotFoundResult();
  }
  return createWorkOrderMutationErrorResult(
    params.error,
    params.fallback,
    params.code,
  );
}

export async function resolveWorkOrderRequest(params: {
  repository: RequestRepository;
  id: string;
  userContext: UserContext;
  action: "approve" | "reject";
  reason?: string;
}): Promise<ServiceResult<WorkOrderWithRelations>> {
  try {
    return await resolveRequestMutation(params);
  } catch (error) {
    return createRequestMutationErrorResult(params.action, error);
  }
}

async function resolveRequestMutation(params: {
  repository: RequestRepository;
  id: string;
  userContext: UserContext;
  action: "approve" | "reject";
  reason?: string;
}) {
  const workOrder = await getValidatedRequestWorkOrder(params);
  if (!workOrder.success) {
    return workOrder;
  }

  return completeRequestResolution(
    buildRequestResolutionInput(params, workOrder.data),
  );
}

function buildRequestResolutionInput(
  params: {
    repository: RequestRepository;
    id: string;
    userContext: UserContext;
    action: "approve" | "reject";
    reason?: string;
  },
  workOrder: WorkOrderActivityTarget,
) {
  return {
    repository: params.repository,
    id: params.id,
    userId: params.userContext.id,
    action: params.action,
    reason: params.reason,
    workOrder,
  };
}

async function completeRequestResolution(params: {
  repository: RequestRepository;
  id: string;
  userId: string;
  action: "approve" | "reject";
  reason?: string;
  workOrder: WorkOrderActivityTarget;
}) {
  await persistRequestDecision(params);
  await finalizeRequestDecision(params);
  return findSuccessResult({ repository: params.repository, id: params.id });
}

async function getValidatedRequestWorkOrder(params: {
  repository: RequestRepository;
  id: string;
  userContext: UserContext;
  action: "approve" | "reject";
}): Promise<ServiceResult<WorkOrderWithRelations>> {
  const workOrder = await getAccessibleWorkOrder({
    repository: params.repository,
    id: params.id,
    userContext: params.userContext,
  });
  if (!workOrder.success) {
    return workOrder;
  }

  return validateRequestState(workOrder.data, params.action) || workOrder;
}

async function finalizeRequestDecision(params: {
  id: string;
  userId: string;
  action: "approve" | "reject";
  reason?: string;
  workOrder: WorkOrderActivityTarget;
}) {
  recordWorkOrderActivity({
    action:
      params.action === "approve"
        ? WORK_ORDER_ACTIVITY_ACTIONS.APPROVE_REQUEST
        : WORK_ORDER_ACTIVITY_ACTIONS.REJECT_REQUEST,
    workOrder: params.workOrder,
    actorId: params.userId,
    details: params.reason ? { reason: params.reason } : undefined,
  });
  await invalidateWorkOrderCaches();
}

function createRequestMutationErrorResult(
  action: "approve" | "reject",
  error: unknown,
): ServiceResult<WorkOrderWithRelations> {
  return createWorkOrderMutationErrorResult(
    error,
    action === "approve"
      ? "Gagal menyetujui permintaan"
      : "Gagal menolak permintaan",
    action === "approve" ? "APPROVE_ERROR" : "REJECT_ERROR",
  );
}
