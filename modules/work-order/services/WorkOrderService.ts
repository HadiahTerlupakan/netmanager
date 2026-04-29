import type { PrismaClient, WorkOrderStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  applyWorkOrderListRestrictions,
  buildInactiveEmployeeMessage,
  createEmptyWorkOrderListResult,
  createWorkOrderNotFoundResult,
  getWorkOrderErrorCode,
  hasActiveEmployeeStatus,
  isGenericNotFoundError,
  isMobileMaterialValidationError,
  isWorkOrderNotFoundError,
  logWorkOrderServiceError,
  resolveTenantIdFromContext,
} from "./work-order-service-helpers";
import {
  buildWorkOrderUpdatePayload,
  ensureRejectionReason,
  ensureRequestedStatus,
  ensureWorkOrderExists,
} from "./work-order-service-guards";
import { processMobileMaterialReturn } from "./work-order-mobile-material-return";
import { InventoryStockService } from "@/modules/inventory";
import { UserLookupService } from "@/modules/users";
import type {
  WorkOrderListSummary,
  WorkOrderWithRelations,
} from "../repositories/IWorkOrderRepository";
import type {
  CreateWorkOrderInput,
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  ServiceResult,
  UpdateWorkOrderInput,
  UserContext,
  WorkOrderListOptions,
} from "./work-order-service.contracts";
import {
  WorkOrderMaterialRepository,
  type MobileWorkOrderMaterialInput,
  type MobileWorkOrderMaterialResult,
} from "../repositories/WorkOrderMaterialRepository";
import {
  TicketRepository,
  WorkOrderTemplateRepository,
  WarrantyCheckRepository,
} from "../repositories/WorkOrderSupportRepositories";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import {
  validateMobileWorkOrderMaterialAccess,
  validateMobileWorkOrderMaterialReturnAccess,
  validateWorkOrderAccess as validateWorkOrderAccessHelper,
} from "./work-order-access";
import { prepareWorkOrderCreateData } from "./work-order-create-preparation";
import {
  broadcastWorkOrderCreatedSafely,
  invalidateWorkOrderCaches,
  linkWorkOrderToTicketSafely,
  logMobileMaterialReturnActivity,
  logWorkOrderActivity,
  notifyMobileWorkOrderMaterialActionSafely,
  notifyMobileWorkOrderMaterialReturnSafely,
  notifyWorkOrderCreatedSafely,
  publishWorkOrderAssignmentSideEffects,
  publishWorkOrderCreatedEvent,
  publishWorkOrderStatusSideEffects,
} from "./work-order-side-effects";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";
import { WorkOrderActivityService } from "./WorkOrderActivityService";
export type {
  CreateWorkOrderInput,
  MobileWorkOrderMaterialReturnInput,
  MobileWorkOrderMaterialReturnResult,
  ServiceResult,
  UpdateWorkOrderInput,
  UserContext,
  WorkOrderListOptions,
} from "./work-order-service.contracts";
/**
 * WorkOrderService - Business logic layer for Work Orders
 */
export class WorkOrderService {
  private repository: WorkOrderRepository;
  private userRepo: UserLookupService;
  private ticketRepo: TicketRepository;
  private templateRepo: WorkOrderTemplateRepository;
  private warrantyRepo: WarrantyCheckRepository;
  private materialRepo: WorkOrderMaterialRepository;
  private inventoryRepo: InventoryStockService;
  private prismaClient: PrismaClient;
  private activityService: WorkOrderActivityService;
  constructor(prismaClient?: PrismaClient) {
    this.prismaClient = prismaClient ?? defaultPrisma;
    this.repository = new WorkOrderRepository(this.prismaClient);
    this.userRepo = new UserLookupService();
    this.ticketRepo = new TicketRepository();
    this.templateRepo = new WorkOrderTemplateRepository();
    this.warrantyRepo = new WarrantyCheckRepository();
    this.materialRepo = new WorkOrderMaterialRepository(this.prismaClient);
    this.inventoryRepo = new InventoryStockService();
    this.activityService = new WorkOrderActivityService(this.repository);
  }
  /**
   * Get paginated list of work orders with site/department restrictions
   */
  async getWorkOrders(options: WorkOrderListOptions): Promise<
    ServiceResult<{
      workOrders: unknown[];
      total: number;
      page: number;
      totalPages: number;
      summary: WorkOrderListSummary;
    }>
  > {
    try {
      const {
        page = 1,
        limit = 20,
        filters = {},
        userPermissions = [],
        userDepartmentId,
        userSiteId,
        userRole,
      } = options;
      const appliedFilters = applyWorkOrderListRestrictions({
        filters,
        userPermissions,
        userDepartmentId,
        userSiteId,
        userRole,
      });
      if (!appliedFilters) {
        return createEmptyWorkOrderListResult(page);
      }
      const result = await this.repository.findAllForList(
        appliedFilters,
        page,
        limit,
      );
      return { success: true, data: result };
    } catch (error) {
      logWorkOrderServiceError("WorkOrderService.getWorkOrders failed", error);
      return {
        success: false,
        error: "Gagal mengambil daftar work order",
        code: "FETCH_ERROR",
      };
    }
  }
  /**
   * Get work order requests (status = REQUESTED)
   */
  async getWorkOrderRequests(
    filters: { departmentId?: string; siteId?: string; search?: string },
    page: number = 1,
    limit: number = 20,
  ): Promise<
    ServiceResult<{
      workOrders: unknown[];
      total: number;
      page: number;
      totalPages: number;
    }>
  > {
    try {
      const result = await this.repository.findAllRequests(
        filters,
        page,
        limit,
      );
      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "WorkOrderService.getWorkOrderRequests failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil daftar permintaan work order",
        code: "FETCH_ERROR",
      };
    }
  }
  /**
   * Get work order statistics
   */
  async getStatistics(filters: {
    departmentId?: string;
    siteId?: string;
    assignedToId?: string;
  }): Promise<ServiceResult<unknown>> {
    try {
      const stats = await this.repository.getStatistics(filters);
      return { success: true, data: stats };
    } catch (error) {
      logger.error(
        "WorkOrderService.getStatistics failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil statistik",
        code: "FETCH_ERROR",
      };
    }
  }
  /**
   * Get recent work orders
   */
  async getRecentWorkOrders(
    limit: number = 5,
    filters: { departmentId?: string },
  ): Promise<ServiceResult<unknown[]>> {
    try {
      const workOrders = await this.repository.getRecentWorkOrders(
        limit,
        filters,
      );
      return { success: true, data: workOrders };
    } catch (error) {
      logger.error(
        "WorkOrderService.getRecentWorkOrders failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal mengambil work order terbaru",
        code: "FETCH_ERROR",
      };
    }
  }
  /**
   * Get single work order by ID
   */
  async getWorkOrderById(
    id: string,
    userContext?: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      const workOrder = userContext
        ? await this.validateWorkOrderAccess(id, userContext)
        : await this.repository.findById(id);
      if (!workOrder) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return { success: true, data: workOrder };
    } catch (error) {
      logger.error(
        "WorkOrderService.getWorkOrderById failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengambil work order",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "FETCH_ERROR",
      };
    }
  }
  // ==================== CREATE OPERATIONS ====================
  /**
   * Create new work order with validation, notifications, and logging
   */
  async createWorkOrder(
    input: CreateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      const createdById = userContext.id;
      const createData = await prepareWorkOrderCreateData({
        input,
        userContext,
        warrantyRepo: this.warrantyRepo,
      });
      const workOrder = await this.repository.create(createData);
      await notifyWorkOrderCreatedSafely(workOrder, userContext.id);
      await publishWorkOrderCreatedEvent({
        workOrder,
        triggeredBy: createdById,
      });
      broadcastWorkOrderCreatedSafely(workOrder);
      if (input.ticketId) {
        await linkWorkOrderToTicketSafely({
          ticketRepo: this.ticketRepo,
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
    } catch (error) {
      logger.error(
        "WorkOrderService.createWorkOrder failed",
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
  }
  // ==================== UPDATE OPERATIONS ====================
  /**
   * Update work order
   */
  async updateWorkOrder(
    id: string,
    input: UpdateWorkOrderInput,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      // Check exists
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      const updateData = buildWorkOrderUpdatePayload(input);
      const updated = await this.repository.update(id, updateData);
      logWorkOrderActivity("UPDATE", "Work Order", userContext.id, {
        id: updated.id,
        number: updated.workOrderNumber,
        changes: input,
      });
      await invalidateWorkOrderCaches();
      // Refetch with relations
      const result = await this.repository.findById(id);
      return { success: true, data: result as WorkOrderWithRelations };
    } catch (error) {
      logger.error(
        "WorkOrderService.updateWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengupdate work order",
        code: getWorkOrderErrorCode(error, "UPDATE_ERROR"),
      };
    }
  }
  /**
   * Update work order status with notifications
   */
  async updateStatus(
    id: string,
    status: WorkOrderStatus,
    userContext: UserContext,
    resolutionNotes?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      const previousStatus = existing.status;
      const userId = userContext.id;
      // Update status
      if (status === "COMPLETED" && resolutionNotes) {
        await this.repository.complete(id, resolutionNotes, userId);
      } else {
        await this.repository.updateStatus(id, status, userId);
      }
      const fullWorkOrder = await this.repository.findById(id);
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
      await invalidateWorkOrderCaches();
      const result = await this.repository.findById(id);
      return { success: true, data: result as WorkOrderWithRelations };
    } catch (error) {
      logWorkOrderServiceError("WorkOrderService.updateStatus failed", error);
      if (isWorkOrderNotFoundError(error)) {
        return createWorkOrderNotFoundResult();
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengupdate status",
        code: getWorkOrderErrorCode(error, "STATUS_ERROR"),
      };
    }
  }
  // ==================== ASSIGNMENT OPERATIONS ====================
  /**
   * Assign work order to employee
   */
  async assignWorkOrder(
    id: string,
    employeeId: string,
    userContext: UserContext,
    role?: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      // Validate employee status
      const employee = await this.userRepo.findById(employeeId);
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
      const assignedById = userContext.id;
      // Assign
      await this.repository.assign(id, employeeId, role, assignedById);
      const fullWorkOrder = await this.repository.findById(id);
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
      const result = await this.repository.findById(id);
      return { success: true, data: result as WorkOrderWithRelations };
    } catch (error) {
      logger.error(
        "WorkOrderService.assignWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menugaskan work order",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "ASSIGN_ERROR",
      };
    }
  }
  // ==================== APPROVAL OPERATIONS ====================
  /**
   * Approve work order request
   */
  async approveRequest(
    id: string,
    userContext: UserContext,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      const invalidStatusResult = ensureRequestedStatus(
        existing.status,
        "disetujui",
      );
      if (invalidStatusResult) {
        return invalidStatusResult;
      }
      const approvedById = userContext.id;
      await this.repository.approveRequest(id, approvedById);
      logWorkOrderActivity("APPROVE", "Work Order", approvedById, {
        id,
        number: existing.workOrderNumber,
      });
      await invalidateWorkOrderCaches();
      const result = await this.repository.findById(id);
      return { success: true, data: result as WorkOrderWithRelations };
    } catch (error) {
      logger.error(
        "WorkOrderService.approveRequest failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal menyetujui permintaan",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "APPROVE_ERROR",
      };
    }
  }
  /**
   * Reject work order request
   */
  async rejectRequest(
    id: string,
    userContext: UserContext,
    reason: string,
  ): Promise<ServiceResult<WorkOrderWithRelations>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const invalidReasonResult = ensureRejectionReason(reason);
      if (invalidReasonResult) {
        return invalidReasonResult;
      }
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      const invalidStatusResult = ensureRequestedStatus(
        existing.status,
        "ditolak",
      );
      if (invalidStatusResult) {
        return invalidStatusResult;
      }
      const rejectedById = userContext.id;
      await this.repository.rejectRequest(id, rejectedById, reason);
      logWorkOrderActivity("REJECT", "Work Order", rejectedById, {
        id,
        number: existing.workOrderNumber,
        reason,
      });
      await invalidateWorkOrderCaches();
      const result = await this.repository.findById(id);
      return { success: true, data: result as WorkOrderWithRelations };
    } catch (error) {
      logger.error(
        "WorkOrderService.rejectRequest failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menolak permintaan",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "REJECT_ERROR",
      };
    }
  }
  // ==================== DELETE OPERATIONS ====================
  /**
   * Delete work order
   */
  async deleteWorkOrder(
    id: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    try {
      await this.validateWorkOrderAccess(id, userContext);
      const existing = await this.repository.findById(id);
      const missingResult = ensureWorkOrderExists(existing);
      if (missingResult) {
        return missingResult;
      }
      const deletedById = userContext.id;
      await this.repository.delete(id);
      logWorkOrderActivity("DELETE", "Work Order", deletedById, {
        id,
        number: existing.workOrderNumber,
      });
      await invalidateWorkOrderCaches();
      return { success: true };
    } catch (error) {
      logWorkOrderServiceError(
        "WorkOrderService.deleteWorkOrder failed",
        error,
      );
      if (isWorkOrderNotFoundError(error)) {
        return createWorkOrderNotFoundResult();
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menghapus work order",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "DELETE_ERROR",
      };
    }
  }
  // ==================== MATERIAL & TEMPLATE OPERATIONS ====================
  /**
   * Add material usage to work order
   */
  async addMaterial(
    workOrderId: string,
    barangId: string,
    quantity: number,
    userContext: UserContext,
    notes?: string,
    preferredGudangId?: string,
  ): Promise<ServiceResult<unknown>> {
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);
      const actorId = userContext.id;
      const material = await this.materialRepo.addMaterialWithStockDeduction(
        workOrderId,
        barangId,
        quantity,
        actorId,
        notes ?? null,
        preferredGudangId,
      );
      return { success: true, data: material };
    } catch (error) {
      logger.error(
        "WorkOrderService.createTasksFromTemplate failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error: "Gagal membuat tugas dari template",
        code: "CREATE_TASKS_ERROR",
      };
    }
  }
  async addMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialResult[] }>> {
    try {
      const workOrder = await validateMobileWorkOrderMaterialAccess({
        repository: this.repository,
        workOrderId,
        userContext,
      });
      const results =
        await this.materialRepo.addMobileMaterialsWithStockDeduction({
          workOrder: {
            id: workOrder.id,
            tenantId: workOrder.tenantId,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            status: workOrder.status,
          },
          items,
          actorId: userContext.id,
        });
      const materialList = results
        .map((m) => `${m.nama} (${m.jumlah})`)
        .join(", ");
      await notifyMobileWorkOrderMaterialActionSafely({
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        actionType: "MATERIAL_PICKUP",
        actionMessage: `Mengambil barang: ${materialList}`,
        triggeredByUserId: userContext.id,
        triggeredByName: triggeredByName || undefined,
        ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
        ...(workOrder.siteId && { siteId: workOrder.siteId }),
      });
      return { success: true, data: { items: results } };
    } catch (error) {
      logger.error(
        "WorkOrderService.addMobileMaterials failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
        code:
          getWorkOrderErrorCode(error, "") ||
          (isMobileMaterialValidationError(error)
            ? "VALIDATION_ERROR"
            : isGenericNotFoundError(error)
              ? "NOT_FOUND"
              : "INTERNAL_ERROR"),
      };
    }
  }
  async returnMobileMaterials(
    workOrderId: string,
    items: MobileWorkOrderMaterialReturnInput[],
    userContext: UserContext,
    triggeredByName?: string,
  ): Promise<ServiceResult<{ items: MobileWorkOrderMaterialReturnResult[] }>> {
    try {
      const workOrder = await validateMobileWorkOrderMaterialReturnAccess({
        repository: this.repository,
        workOrderId,
        userContext,
      });
      const tenantId = resolveTenantIdFromContext({
        workOrderTenantId: workOrder.tenantId,
        userContext,
      });
      const results = await processMobileMaterialReturn({
        prismaClient: this.prismaClient,
        inventoryService: this.inventoryRepo,
        workOrder: {
          id: workOrder.id,
          tenantId: workOrder.tenantId,
          workOrderNumber: workOrder.workOrderNumber,
          title: workOrder.title,
          status: workOrder.status,
        },
        items,
        userContext,
        tenantId: tenantId || undefined,
      });
      const materialList = results
        .map((m) => `${m.nama} (${m.jumlah})`)
        .join(", ");
      await notifyMobileWorkOrderMaterialReturnSafely({
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        actionType: "MATERIAL_RETURN",
        actionMessage: `Mengembalikan barang: ${materialList}`,
        triggeredByUserId: userContext.id,
        triggeredByName: triggeredByName || undefined,
        ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
        ...(workOrder.siteId && { siteId: workOrder.siteId }),
      });
      logMobileMaterialReturnActivity({
        userId: userContext.id,
        tenantId: tenantId || undefined,
        workOrderId: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        items: results,
      });
      await invalidateWorkOrderCaches();
      return { success: true, data: { items: results } };
    } catch (error) {
      logger.error(
        "WorkOrderService.returnMobileMaterials failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Terjadi kesalahan server",
        code:
          getWorkOrderErrorCode(error, "") ||
          (isMobileMaterialValidationError(error)
            ? "VALIDATION_ERROR"
            : isGenericNotFoundError(error)
              ? "NOT_FOUND"
              : "INTERNAL_ERROR"),
      };
    }
  }
  // ==================== PRIVATE HELPERS ====================
  /**
   * Validate user access to a specific work order based on RBAC and restrictions
   */
  private async validateWorkOrderAccess(
    workOrderId: string,
    userContext: UserContext,
  ): Promise<WorkOrderWithRelations | null> {
    return validateWorkOrderAccessHelper({
      repository: this.repository,
      workOrderId,
      userContext,
    });
  }
  // ==================== COMMENT & TASK OPERATIONS ====================
  /**
   * Add a comment to a work order
   */
  async addComment(
    workOrderId: string,
    message: string,
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    return this.activityService.addComment(workOrderId, message, userContext);
  }
  /**
   * Add a task to a work order
   */
  async addTask(
    workOrderId: string,
    taskData: {
      title: string;
      description?: string;
      order?: number;
    },
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    return this.activityService.addTask(workOrderId, taskData, userContext);
  }
  /**
   * Add attachment to work order
   */
  async addAttachment(
    workOrderId: string,
    data: {
      fileName: string;
      filePath: string;
      fileSize: number;
      fileType: string;
      caption?: string;
    },
    userContext: UserContext,
  ): Promise<ServiceResult<unknown>> {
    return this.activityService.addAttachment(workOrderId, data, userContext);
  }
  /**
   * Delete attachment from work order
   */
  async deleteAttachment(
    workOrderId: string,
    attachmentId: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    return this.activityService.deleteAttachment(
      workOrderId,
      attachmentId,
      userContext,
    );
  }
}
// Singleton instance
let workOrderServiceInstance: WorkOrderService | null = null;
export function getWorkOrderService(): WorkOrderService {
  if (!workOrderServiceInstance) {
    workOrderServiceInstance = new WorkOrderService();
  }
  return workOrderServiceInstance;
}
