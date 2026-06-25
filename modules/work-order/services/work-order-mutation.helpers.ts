import type { WorkOrderStatus } from "../types/work-order.enums";
import { logger } from "@/lib/logger";
import type { UserLookupService } from "@/modules/users";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import {
  ensureRequestedStatus,
  ensureWorkOrderExists,
} from "./work-order-service-guards";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  buildInactiveEmployeeMessage,
  getWorkOrderErrorCode,
  hasActiveEmployeeStatus,
} from "./work-order-service-helpers";
import type { ServiceResult } from "./work-order-service.contracts";
import {
  invalidateWorkOrderCaches,
  logWorkOrderActivity,
  publishWorkOrderAssignmentSideEffects,
  publishWorkOrderStatusSideEffects,
} from "./work-order-side-effects";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";

type EmployeeValidationResult =
  | { success: true; data: { name?: string | null } }
  | { success: false; error: string; code: string };

export async function persistWorkOrderStatus(params: {
  repository: WorkOrderRepository;
  id: string;
  status: WorkOrderStatus;
  userId: string;
  resolutionNotes?: string;
}) {
  if (params.status === "COMPLETED" && params.resolutionNotes) {
    await params.repository.complete(
      params.id,
      params.resolutionNotes,
      params.userId,
    );
    return;
  }

  await params.repository.updateStatus(params.id, params.status, params.userId);
}

export async function publishStatusMutationSideEffects(params: {
  repository: WorkOrderRepository;
  id: string;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}) {
  await publishUpdatedWorkOrderStatusSideEffects(params);
  await syncWoStatusToTicket(params.id, params.status);
  logStatusMutationActivity(params);
}

async function publishUpdatedWorkOrderStatusSideEffects(params: {
  repository: WorkOrderRepository;
  id: string;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}) {
  const fullWorkOrder = await params.repository.findById(params.id);
  if (!fullWorkOrder) {
    return;
  }

  await publishWorkOrderStatusSideEffects({
    workOrder: fullWorkOrder,
    previousStatus: params.previousStatus,
    status: params.status,
    userId: params.userId,
    tenantId: fullWorkOrder.tenantId ?? undefined,
  });
}

function logStatusMutationActivity(params: {
  id: string;
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  userId: string;
}) {
  logWorkOrderActivity("STATUS_CHANGE", "Work Order", params.userId, {
    id: params.id,
    from: params.previousStatus,
    to: params.status,
  });
}

export async function validateAssignmentEmployee(
  userRepo: UserLookupService,
  employeeId: string,
): Promise<EmployeeValidationResult> {
  const employee = await userRepo.findById(employeeId);
  if (!employee) {
    return {
      success: false,
      error: "Karyawan tidak ditemukan",
      code: "EMPLOYEE_NOT_FOUND",
    };
  }
  if (!hasActiveEmployeeStatus(employee as { isActive: boolean })) {
    return {
      success: false,
      error: buildInactiveEmployeeMessage(
        (employee as { name: string | null }).name,
      ),
      code: "EMPLOYEE_INACTIVE",
    };
  }

  return { success: true, data: employee };
}

export async function assignEmployeeToWorkOrder(params: {
  repository: WorkOrderRepository;
  id: string;
  employeeId: string;
  assignedById: string;
  role?: string;
  employee: { name?: string | null };
}) {
  await params.repository.assign(
    params.id,
    params.employeeId,
    params.role,
    params.assignedById,
  );
  await publishAssignedWorkOrderSideEffects(params);
  logAssignedWorkOrderActivity(params);
  await invalidateWorkOrderCaches();
}

async function publishAssignedWorkOrderSideEffects(params: {
  repository: WorkOrderRepository;
  id: string;
  employeeId: string;
  assignedById: string;
  employee: { name?: string | null };
}) {
  const fullWorkOrder = await params.repository.findById(params.id);
  if (!fullWorkOrder) {
    return;
  }

  await publishWorkOrderAssignmentSideEffects({
    workOrder: fullWorkOrder,
    employeeId: params.employeeId,
    employeeName: params.employee.name || undefined,
    assignedById: params.assignedById,
    tenantId: fullWorkOrder.tenantId ?? undefined,
  });
}

function logAssignedWorkOrderActivity(params: {
  id: string;
  employeeId: string;
  assignedById: string;
  role?: string;
}) {
  logWorkOrderActivity("ASSIGN", "Work Order", params.assignedById, {
    id: params.id,
    employeeId: params.employeeId,
    role: params.role,
  });
}

export async function persistRequestDecision(params: {
  repository: Pick<WorkOrderRepository, "approveRequest" | "rejectRequest">;
  id: string;
  userId: string;
  action: "approve" | "reject";
  reason?: string;
}) {
  if (params.action === "approve") {
    await approveWorkOrderRequestDecision(params);
    return;
  }

  await rejectWorkOrderRequestDecision(params);
}

function approveWorkOrderRequestDecision(params: {
  repository: Pick<WorkOrderRepository, "approveRequest">;
  id: string;
  userId: string;
}) {
  return params.repository.approveRequest(params.id, params.userId);
}

function rejectWorkOrderRequestDecision(params: {
  repository: Pick<WorkOrderRepository, "rejectRequest">;
  id: string;
  userId: string;
  reason?: string;
}) {
  return params.repository.rejectRequest(
    params.id,
    params.userId,
    params.reason!,
  );
}

export function validateRequestState(
  existing: WorkOrderWithRelations | null,
  action: "approve" | "reject",
): ServiceResult<WorkOrderWithRelations> | undefined {
  const missingResult = ensureWorkOrderExists(existing);
  if (missingResult) return missingResult;

  return ensureRequestedStatus(
    existing!.status,
    action === "approve" ? "disetujui" : "ditolak",
  );
}

export function createWorkOrderMutationErrorResult<T>(
  error: unknown,
  fallback: string,
  fallbackCode: string,
): ServiceResult<T> {
  return {
    success: false,
    error: error instanceof Error ? error.message : fallback,
    code: getWorkOrderErrorCode(error, fallbackCode),
  };
}

export function handleCreateWorkOrderError(
  error: unknown,
): ServiceResult<WorkOrderWithRelations> {
  logger.error(
    "WorkOrderMutationService.createWorkOrder failed",
    error instanceof Error ? error : undefined,
  );
  if (!isKnownCreateError(error)) {
    return {
      success: false,
      error: "Gagal membuat work order",
      code: "CREATE_ERROR",
    };
  }

  if (error.message === "Tipe, judul, dan deskripsi wajib diisi") {
    return { success: false, error: error.message, code: "VALIDATION_ERROR" };
  }
  return { success: false, error: error.message, code: "FORBIDDEN" };
}

function isKnownCreateError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    (error.message === "Tipe, judul, dan deskripsi wajib diisi" ||
      error.message.includes("Akses ditolak"))
  );
}
