import type { WorkOrderStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { UserLookupService } from "@/modules/users";
import type { WorkOrderWithRelations } from "../repositories/IWorkOrderRepository";

type WorkOrderTicketPayload = {
  workOrderNumber: string;
  title: string;
  type: string;
  scheduledDate?: Date | string | null;
};

type EmployeeValidationResult =
  | { success: true; data: { name?: string | null } }
  | { success: false; error: string; code: string };
import {
  TicketRepository,
  WarrantyCheckRepository,
} from "../repositories/WorkOrderSupportRepositories";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { validateWorkOrderAccess as validateWorkOrderAccessHelper } from "./work-order-access";
import { prepareWorkOrderCreateData } from "./work-order-create-preparation";
import {
  buildWorkOrderUpdatePayload,
  ensureRejectionReason,
  ensureRequestedStatus,
  ensureWorkOrderExists,
} from "./work-order-service-guards";
import {
  buildInactiveEmployeeMessage,
  createWorkOrderNotFoundResult,
  getWorkOrderErrorCode,
  hasActiveEmployeeStatus,
  isWorkOrderNotFoundError,
  logWorkOrderServiceError,
} from "./work-order-service-helpers";
import type {
  CreateWorkOrderInput,
  ServiceResult,
  UpdateWorkOrderInput,
  UserContext,
} from "./work-order-service.contracts";
import {
  broadcastWorkOrderCreatedSafely,
  invalidateWorkOrderCaches,
  linkWorkOrderToTicketSafely,
  logWorkOrderActivity,
  notifyWorkOrderCreatedSafely,
  publishWorkOrderAssignmentSideEffects,
  publishWorkOrderCreatedEvent,
  publishWorkOrderStatusSideEffects,
} from "./work-order-side-effects";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";

type MutationDependencies = {
  repository: WorkOrderRepository;
  userRepo: UserLookupService;
  ticketRepo: TicketRepository;
  warrantyRepo: WarrantyCheckRepository;
};

export class WorkOrderMutationService {
  constructor(private readonly dependencies: MutationDependencies) {}

  /** Create new work order with validation, notifications, and logging. */
  async createWorkOrder(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      return await this.createWorkOrderUnsafe(input, userContext);
    } catch (error) {
      return this.handleCreateError(error);
    }
  }

  /** Update work order. */
  async updateWorkOrder(
    id: string,
    input: UpdateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.dependencies.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) return missingResult;

      const updated = await this.dependencies.repository.update(
        id,
        buildWorkOrderUpdatePayload(input),
      );
      logWorkOrderActivity("UPDATE", "Work Order", userContext.id, {
        id: updated.id,
        number: updated.workOrderNumber,
        changes: input,
      });
      await invalidateWorkOrderCaches();
      return this.findSuccessResult(id);
    } catch (error) {
      logger.error(
        "WorkOrderMutationService.updateWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return this.errorResult(
        error,
        "Gagal mengupdate work order",
        "UPDATE_ERROR",
      );
    }
  }

  /** Update work order status with notifications. */
  async updateStatus(
    id: string,
    status: WorkOrderStatus,
    userContext: UserContext,
    resolutionNotes?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.dependencies.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) return missingResult;

      await this.persistStatus(id, status, userContext.id, resolutionNotes);
      await this.publishStatusSideEffects(
        id,
        existing.status,
        status,
        userContext.id,
      );
      await invalidateWorkOrderCaches();
      return this.findSuccessResult(id);
    } catch (error) {
      logWorkOrderServiceError(
        "WorkOrderMutationService.updateStatus failed",
        error,
      );
      if (isWorkOrderNotFoundError(error))
        return createWorkOrderNotFoundResult();
      return this.errorResult(error, "Gagal mengupdate status", "STATUS_ERROR");
    }
  }

  /** Assign work order to employee. */
  async assignWorkOrder(
    id: string,
    employeeId: string,
    userContext: UserContext,
    role?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.dependencies.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) return missingResult;

      const employeeResult = await this.validateEmployee(employeeId);
      if (employeeResult.success === false) {
        return {
          success: false,
          error: employeeResult.error,
          code: employeeResult.code,
        };
      }

      await this.assignEmployee(
        id,
        employeeId,
        userContext.id,
        role,
        employeeResult.data,
      );
      return this.findSuccessResult(id);
    } catch (error) {
      logger.error(
        "WorkOrderMutationService.assignWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return this.errorResult(
        error,
        "Gagal menugaskan work order",
        "ASSIGN_ERROR",
      );
    }
  }

  /** Approve work order request. */
  async approveRequest(
    id: string,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    return this.resolveRequest(id, userContext, "approve");
  }

  /** Reject work order request. */
  async rejectRequest(
    id: string,
    userContext: UserContext,
    reason: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    const invalidReasonResult = ensureRejectionReason(reason);
    if (invalidReasonResult) return invalidReasonResult;

    return this.resolveRequest(id, userContext, "reject", reason);
  }

  /** Delete work order. */
  async deleteWorkOrder(
    id: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.dependencies.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) return missingResult;

      await this.dependencies.repository.delete(id);
      logWorkOrderActivity("DELETE", "Work Order", userContext.id, {
        id,
        number: existing.workOrderNumber,
      });
      await invalidateWorkOrderCaches();
      return { success: true };
    } catch (error) {
      logWorkOrderServiceError(
        "WorkOrderMutationService.deleteWorkOrder failed",
        error,
      );
      if (isWorkOrderNotFoundError(error))
        return createWorkOrderNotFoundResult();
      return this.errorResult(
        error,
        "Gagal menghapus work order",
        "DELETE_ERROR",
      ) as ServiceResult<void>;
    }
  }

  private async createWorkOrderUnsafe(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ) {
    const createdById = userContext.id;
    const workOrder = await this.dependencies.repository.create(
      await prepareWorkOrderCreateData({
        input,
        userContext,
        warrantyRepo: this.dependencies.warrantyRepo,
      }),
    );

    await notifyWorkOrderCreatedSafely(workOrder, userContext.id);
    await publishWorkOrderCreatedEvent({ workOrder, triggeredBy: createdById });
    broadcastWorkOrderCreatedSafely(workOrder);
    if (input.ticketId)
      await this.linkTicket(input.ticketId, workOrder, createdById);

    logWorkOrderActivity("CREATE", "Work Order", createdById, {
      id: workOrder.id,
      number: workOrder.workOrderNumber,
      title: workOrder.title,
    });
    await invalidateWorkOrderCaches();
    return { success: true, data: workOrder as WorkOrderWithRelations };
  }

  private async linkTicket(
    ticketId: string,
    workOrder: WorkOrderTicketPayload,
    userId: string,
  ) {
    await linkWorkOrderToTicketSafely({
      ticketRepo: this.dependencies.ticketRepo,
      workOrder,
      ticketId,
      userId,
    });
  }

  private async persistStatus(
    id: string,
    status: WorkOrderStatus,
    userId: string,
    resolutionNotes?: string,
  ) {
    if (status === "COMPLETED" && resolutionNotes) {
      await this.dependencies.repository.complete(id, resolutionNotes, userId);
      return;
    }

    await this.dependencies.repository.updateStatus(id, status, userId);
  }

  private async publishStatusSideEffects(
    id: string,
    previousStatus: WorkOrderStatus,
    status: WorkOrderStatus,
    userId: string,
  ) {
    const fullWorkOrder = await this.dependencies.repository.findById(id);
    if (fullWorkOrder) {
      await publishWorkOrderStatusSideEffects({
        workOrder: fullWorkOrder,
        previousStatus,
        status,
        userId,
      });
    }
    await syncWoStatusToTicket(id, status);
    logWorkOrderActivity("STATUS_CHANGE", "Work Order", userId, {
      id,
      from: previousStatus,
      to: status,
    });
  }

  private async validateEmployee(
    employeeId: string,
  ): Promise<EmployeeValidationResult> {
    const employee = await this.dependencies.userRepo.findById(employeeId);
    if (!employee) {
      return {
        success: false as const,
        error: "Karyawan tidak ditemukan",
        code: "EMPLOYEE_NOT_FOUND",
      };
    }
    if (!hasActiveEmployeeStatus(employee as { isActive: boolean })) {
      return {
        success: false as const,
        error: buildInactiveEmployeeMessage(
          (employee as { name: string | null }).name,
        ),
        code: "EMPLOYEE_INACTIVE",
      };
    }

    return { success: true as const, data: employee };
  }

  private async assignEmployee(
    id: string,
    employeeId: string,
    assignedById: string,
    role: string | undefined,
    employee: { name?: string | null },
  ) {
    await this.dependencies.repository.assign(
      id,
      employeeId,
      role,
      assignedById,
    );
    const fullWorkOrder = await this.dependencies.repository.findById(id);
    if (fullWorkOrder) {
      await publishWorkOrderAssignmentSideEffects({
        workOrder: fullWorkOrder,
        employeeId,
        employeeName: employee.name || undefined,
        assignedById,
      });
    }
    logWorkOrderActivity("ASSIGN", "Work Order", assignedById, {
      id,
      employeeId,
      role,
    });
    await invalidateWorkOrderCaches();
  }

  private async resolveRequest(
    id: string,
    userContext: UserContext,
    action: "approve" | "reject",
    reason?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.dependencies.repository.findById(id);
      const validationResult = this.validateRequestState(existing, action);
      if (validationResult) return validationResult;

      await this.persistRequestDecision(id, userContext.id, action, reason);
      logWorkOrderActivity(
        action === "approve" ? "APPROVE" : "REJECT",
        "Work Order",
        userContext.id,
        {
          id,
          number: existing!.workOrderNumber,
          ...(reason ? { reason } : {}),
        },
      );
      await invalidateWorkOrderCaches();
      return this.findSuccessResult(id);
    } catch (error) {
      logger.error(
        `WorkOrderMutationService.${action}Request failed`,
        error instanceof Error ? error : undefined,
      );
      return this.errorResult(
        error,
        action === "approve"
          ? "Gagal menyetujui permintaan"
          : "Gagal menolak permintaan",
        action === "approve" ? "APPROVE_ERROR" : "REJECT_ERROR",
      );
    }
  }

  private validateRequestState(
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

  private async persistRequestDecision(
    id: string,
    userId: string,
    action: "approve" | "reject",
    reason?: string,
  ) {
    if (action === "approve") {
      await this.dependencies.repository.approveRequest(id, userId);
      return;
    }

    await this.dependencies.repository.rejectRequest(id, userId, reason!);
  }

  private async findSuccessResult(id: string) {
    const result = await this.dependencies.repository.findById(id);
    return { success: true, data: result as WorkOrderWithRelations };
  }

  private async validateWorkOrderAccess(
    workOrderId: string,
    userContext: UserContext,
  ) {
    return validateWorkOrderAccessHelper({
      repository: this.dependencies.repository,
      workOrderId,
      userContext,
    });
  }

  private handleCreateError(
    error: unknown,
  ): ServiceResult<WorkOrderWithRelations> {
    logger.error(
      "WorkOrderMutationService.createWorkOrder failed",
      error instanceof Error ? error : undefined,
    );
    if (error instanceof Error) {
      if (error.message === "Tipe, judul, dan deskripsi wajib diisi") {
        return {
          success: false,
          error: error.message,
          code: "VALIDATION_ERROR",
        };
      }
      if (error.message.includes("Akses ditolak")) {
        return { success: false, error: error.message, code: "FORBIDDEN" };
      }
    }
    return {
      success: false,
      error: "Gagal membuat work order",
      code: "CREATE_ERROR",
    };
  }

  private errorResult<T>(
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
}
