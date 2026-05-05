import { logger } from "@/lib/logger";
import { UserLookupService } from "@/modules/users";
import type { WorkOrderStatus } from "../types/work-order.enums";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import {
  TicketRepository,
  WarrantyCheckRepository,
} from "../repositories/WorkOrderSupportRepositories";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  assignEmployeeToWorkOrder,
  createWorkOrderMutationErrorResult,
  handleCreateWorkOrderError,
  persistWorkOrderStatus,
  publishStatusMutationSideEffects,
  validateAssignmentEmployee,
} from "./work-order-mutation.helpers";
import { prepareWorkOrderCreateData } from "./work-order-create-preparation";
import { ensureRejectionReason } from "./work-order-service-guards";
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
  publishWorkOrderCreatedEvent,
} from "./work-order-side-effects";
import {
  findSuccessResult,
  getAccessibleWorkOrder,
  handleMutationError,
  resolveWorkOrderRequest,
} from "./work-order-mutation-access";
import { buildWorkOrderUpdatePayload } from "./work-order-service-guards";

type MutationDependencies = {
  repository: WorkOrderRepository;
  userRepo: UserLookupService;
  ticketRepo: TicketRepository;
  warrantyRepo: WarrantyCheckRepository;
};

type WorkOrderMutationResult = ServiceResult<WorkOrderWithRelations>;

export class WorkOrderMutationService {
  constructor(private readonly dependencies: MutationDependencies) {}

  /** Create new work order with validation, notifications, and logging. */
  async createWorkOrder(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ): Promise<WorkOrderMutationResult> {
    try {
      return await this.createWorkOrderUnsafe(input, userContext);
    } catch (error) {
      return handleCreateWorkOrderError(error);
    }
  }

  /** Update work order. */
  async updateWorkOrder(
    id: string,
    input: UpdateWorkOrderInput,
    userContext: UserContext,
  ): Promise<WorkOrderMutationResult> {
    try {
      const existing = await getAccessibleWorkOrder({
        repository: this.dependencies.repository,
        id,
        userContext,
      });
      if (!existing.success) return existing;

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
      return findSuccessResult({
        repository: this.dependencies.repository,
        id,
      });
    } catch (error) {
      logger.error(
        "WorkOrderMutationService.updateWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return createWorkOrderMutationErrorResult(
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
  ): Promise<WorkOrderMutationResult> {
    try {
      const existing = await getAccessibleWorkOrder({
        repository: this.dependencies.repository,
        id,
        userContext,
      });
      if (!existing.success) return existing;

      await persistWorkOrderStatus({
        repository: this.dependencies.repository,
        id,
        status,
        userId: userContext.id,
        resolutionNotes,
      });
      await publishStatusMutationSideEffects({
        repository: this.dependencies.repository,
        id,
        previousStatus: existing.data.status,
        status,
        userId: userContext.id,
      });
      await invalidateWorkOrderCaches();
      return findSuccessResult({
        repository: this.dependencies.repository,
        id,
      });
    } catch (error) {
      return handleMutationError({
        message: "WorkOrderMutationService.updateStatus failed",
        error,
        fallback: "Gagal mengupdate status",
        code: "STATUS_ERROR",
      });
    }
  }

  /** Assign work order to employee. */
  async assignWorkOrder(
    id: string,
    employeeId: string,
    userContext: UserContext,
    role?: string,
  ): Promise<WorkOrderMutationResult> {
    try {
      const existing = await getAccessibleWorkOrder({
        repository: this.dependencies.repository,
        id,
        userContext,
      });
      if (!existing.success) return existing;

      const employeeResult = await validateAssignmentEmployee(
        this.dependencies.userRepo,
        employeeId,
      );
      if (employeeResult.success === false) {
        return {
          success: false,
          error: employeeResult.error,
          code: employeeResult.code,
        };
      }

      await assignEmployeeToWorkOrder({
        repository: this.dependencies.repository,
        id,
        employeeId,
        assignedById: userContext.id,
        role,
        employee: employeeResult.data,
      });
      return findSuccessResult({
        repository: this.dependencies.repository,
        id,
      });
    } catch (error) {
      logger.error(
        "WorkOrderMutationService.assignWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return createWorkOrderMutationErrorResult(
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
  ): Promise<WorkOrderMutationResult> {
    return resolveWorkOrderRequest({
      repository: this.dependencies.repository,
      id,
      userContext,
      action: "approve",
    });
  }

  /** Reject work order request. */
  async rejectRequest(
    id: string,
    userContext: UserContext,
    reason: string,
  ): Promise<WorkOrderMutationResult> {
    const invalidReasonResult = ensureRejectionReason(reason);
    if (invalidReasonResult) return invalidReasonResult;

    return resolveWorkOrderRequest({
      repository: this.dependencies.repository,
      id,
      userContext,
      action: "reject",
      reason,
    });
  }

  /** Delete work order. */
  async deleteWorkOrder(
    id: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    try {
      const existing = await getAccessibleWorkOrder({
        repository: this.dependencies.repository,
        id,
        userContext,
      });
      if (!existing.success) {
        return { success: false, error: existing.error, code: existing.code };
      }

      await this.dependencies.repository.delete(id);
      logWorkOrderActivity("DELETE", "Work Order", userContext.id, {
        id,
        number: existing.data.workOrderNumber,
      });
      await invalidateWorkOrderCaches();
      return { success: true };
    } catch (error) {
      return handleMutationError({
        message: "WorkOrderMutationService.deleteWorkOrder failed",
        error,
        fallback: "Gagal menghapus work order",
        code: "DELETE_ERROR",
      }) as ServiceResult<void>;
    }
  }

  private async createWorkOrderUnsafe(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ): Promise<WorkOrderMutationResult> {
    const createdById = userContext.id;
    const workOrder = await this.dependencies.repository.create(
      await prepareWorkOrderCreateData({
        input,
        userContext,
        warrantyRepo: this.dependencies.warrantyRepo,
      }),
    );

    await notifyWorkOrderCreatedSafely(workOrder, createdById);
    await publishWorkOrderCreatedEvent({ workOrder, triggeredBy: createdById });
    broadcastWorkOrderCreatedSafely(workOrder);
    if (input.ticketId) {
      await linkWorkOrderToTicketSafely({
        ticketRepo: this.dependencies.ticketRepo,
        workOrder,
        ticketId: input.ticketId,
        userId: createdById,
      });
    }

    logWorkOrderActivity("CREATE", "Work Order", createdById, {
      id: workOrder.id,
      number: workOrder.workOrderNumber,
      title: workOrder.title,
    });
    await invalidateWorkOrderCaches();
    return { success: true, data: workOrder as WorkOrderWithRelations };
  }
}
