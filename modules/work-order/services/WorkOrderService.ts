/**
 * WorkOrderService
 *
 * Centralized business logic for Work Order operations.
 * This service encapsulates validation, notifications, socket events, and logging.
 * Routes should call this service instead of directly using repositories.
 */

import { randomUUID } from "crypto";

import type {
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderType,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { isPrismaRecordNotFoundError } from "@/lib/prisma-errors";
import { logger } from "@/lib/logger";
import { InventoryRepository } from "@/modules/inventory";
import { UserRepository } from "@/modules/users";

import type {
  WorkOrderFilters,
  WorkOrderListSummary,
  WorkOrderWithRelations,
} from "../repositories/IWorkOrderRepository";
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
import { WorkOrderEventDispatcher } from "@/modules/events";
import { syncWoStatusToTicket } from "./WorkOrderSyncService";

// Types
export interface UserContext {
  id: string;
  name?: string;
  role?: string;
  permissions?: string[];
  siteId?: string;
  departmentId?: string;
  tenantId?: string;
  isSuperAdmin?: boolean;
}

export interface CreateWorkOrderInput {
  type: WorkOrderType;
  title: string;
  description: string;
  priority?: WorkOrderPriority;
  pelangganId?: string;
  departmentId?: string;
  siteId?: string;
  scheduledDate?: Date | string;
  ticketId?: string;
  isInternal?: boolean;
}

export interface UpdateWorkOrderInput {
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  scheduledDate?: Date | string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string;
  resolutionNotes?: string;
}

export interface WorkOrderListOptions {
  page?: number;
  limit?: number;
  filters?: WorkOrderFilters;
  userId?: string;
  userPermissions?: string[];
  userDepartmentId?: string;
  userSiteId?: string;
  userRole?: string;
}

const EMPTY_WORK_ORDER_LIST_SUMMARY: WorkOrderListSummary = {
  completed: 0,
  unfinished: 0,
  focut: 0,
  dismantle: 0,
  averageCompletionTimeHours: 0,
  topCustomers: [],
};

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface MobileWorkOrderMaterialReturnInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: "BARU" | "BEKAS" | "RUSAK";
}

export interface MobileWorkOrderMaterialReturnResult {
  id: string;
  nama: string;
  jumlah: number;
  satuan: string;
  kondisi: string;
  barangId: string;
  gudangId: string;
}

/**
 * WorkOrderService - Business logic layer for Work Orders
 */
export class WorkOrderService {
  private repository: WorkOrderRepository;
  private userRepo: UserRepository;
  private ticketRepo: TicketRepository;
  private templateRepo: WorkOrderTemplateRepository;
  private warrantyRepo: WarrantyCheckRepository;
  private materialRepo: WorkOrderMaterialRepository;
  private inventoryRepo: InventoryRepository;
  private prismaClient: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prismaClient = prismaClient ?? defaultPrisma;
    this.repository = new WorkOrderRepository(this.prismaClient);
    this.userRepo = new UserRepository();
    this.ticketRepo = new TicketRepository();
    this.templateRepo = new WorkOrderTemplateRepository();
    this.warrantyRepo = new WarrantyCheckRepository();
    this.materialRepo = new WorkOrderMaterialRepository(this.prismaClient);
    this.inventoryRepo = new InventoryRepository();
  }

  // ==================== LIST OPERATIONS ====================

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

      const appliedFilters = { ...filters };

      // Apply department restriction
      const hasDepartmentRestriction = userPermissions.includes(
        "workorders:department_only",
      );
      const isSuperAdmin = userRole === "SUPER_ADMIN";

      if (hasDepartmentRestriction && !isSuperAdmin) {
        if (!userDepartmentId) {
          return {
            success: true,
            data: {
              workOrders: [],
              total: 0,
              page,
              totalPages: 0,
              summary: EMPTY_WORK_ORDER_LIST_SUMMARY,
            },
          };
        }
        appliedFilters.departmentId = userDepartmentId;
      }

      // Apply site restriction
      const hasSiteRestriction = userPermissions.includes(
        "workorders:site_only",
      );
      if (hasSiteRestriction && !isSuperAdmin) {
        if (!userSiteId) {
          return {
            success: true,
            data: {
              workOrders: [],
              total: 0,
              page,
              totalPages: 0,
              summary: EMPTY_WORK_ORDER_LIST_SUMMARY,
            },
          };
        }
        appliedFilters.siteId = userSiteId;
      }

      // Use optimized query for list views
      const result = await this.repository.findAllForList(
        appliedFilters,
        page,
        limit,
      );

      return { success: true, data: result };
    } catch (error) {
      logger.error(
        "WorkOrderService.getWorkOrders failed",
        error instanceof Error ? error : undefined,
      );
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      // Check exists
      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      // Update - ensure scheduledDate is Date or undefined
      const { scheduledDate: rawScheduledDate, ...restInput } = input;
      const updateData = {
        ...restInput,
        ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
      };

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
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "UPDATE_ERROR",
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
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
      logger.error(
        "WorkOrderService.updateStatus failed",
        error instanceof Error ? error : undefined,
      );
      if (
        isPrismaRecordNotFoundError(error) ||
        (error instanceof Error &&
          error.message === "Work order tidak ditemukan")
      ) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal mengupdate status",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "STATUS_ERROR",
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
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

      if (!(employee as { isActive: boolean }).isActive) {
        return {
          success: false,
          error: `Tidak dapat menugaskan work order ke karyawan yang tidak aktif: ${(employee as { name: string | null }).name || "Tidak Diketahui"}`,
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "REQUESTED") {
        return {
          success: false,
          error:
            "Hanya work order dengan status REQUESTED yang dapat disetujui",
          code: "INVALID_STATUS",
        };
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      if (!reason) {
        return {
          success: false,
          error: "Alasan penolakan wajib diisi",
          code: "VALIDATION_ERROR",
        };
      }

      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      if (existing.status !== "REQUESTED") {
        return {
          success: false,
          error: "Hanya work order dengan status REQUESTED yang dapat ditolak",
          code: "INVALID_STATUS",
        };
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
      // Validate access
      await this.validateWorkOrderAccess(id, userContext);

      const existing = await this.repository.findById(id);
      if (!existing) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
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
      logger.error(
        "WorkOrderService.deleteWorkOrder failed",
        error instanceof Error ? error : undefined,
      );
      if (
        isPrismaRecordNotFoundError(error) ||
        (error instanceof Error &&
          error.message === "Work order tidak ditemukan")
      ) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
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
      // Validate access
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
          error instanceof Error &&
          (error.message.includes("Akses ditolak") ||
            error.message.includes("tidak memiliki akses"))
            ? "FORBIDDEN"
            : error instanceof Error &&
                (error.message.includes("wajib") ||
                  error.message.includes("harus") ||
                  error.message.includes("Stok") ||
                  error.message.includes("Data stok"))
              ? "VALIDATION_ERROR"
              : error instanceof Error &&
                  error.message.includes("tidak ditemukan")
                ? "NOT_FOUND"
                : "INTERNAL_ERROR",
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

      const tenantId = workOrder.tenantId || userContext.tenantId;
      const results = await this.prismaClient.$transaction(async (tx) => {
        const createdItems: MobileWorkOrderMaterialReturnResult[] = [];

        for (const item of items) {
          const kondisi = item.kondisi || "BEKAS";
          const masuk = await this.inventoryRepo.addStockInTransaction(tx, {
            barangId: item.barangId,
            gudangId: item.gudangId,
            jumlah: item.jumlah,
            kondisi,
            userId: userContext.id,
            keterangan: `Pengembalian dari Work Order ${workOrder.workOrderNumber} - ${workOrder.title}`,
            tenantId: tenantId || undefined,
          });

          const masukWithBarang = masuk as typeof masuk & {
            barang: { nama: string; satuan: string };
          };

          createdItems.push({
            id: masuk.id,
            nama: masukWithBarang.barang.nama,
            jumlah: item.jumlah,
            satuan: masukWithBarang.barang.satuan,
            kondisi,
            barangId: item.barangId,
            gudangId: item.gudangId,
          });
        }

        await tx.$executeRaw`
          UPDATE "work_orders"
          SET "returnedMaterials" = COALESCE("returnedMaterials", '[]'::jsonb) || ${JSON.stringify(createdItems)}::jsonb,
              "updatedAt" = NOW()
          WHERE "id" = ${workOrder.id}
        `;

        const materialList = createdItems
          .map((m) => `${m.nama} - ${m.kondisi} (${m.jumlah} ${m.satuan})`)
          .join(", ");

        await tx.workOrderUpdates.create({
          data: {
            id: randomUUID(),
            workOrderId: workOrder.id,
            createdById: userContext.id,
            updateType: "MATERIAL_RETURN",
            message: `Mengembalikan barang: ${materialList}`,
            oldStatus: workOrder.status,
            newStatus: workOrder.status,
            ...(tenantId ? { tenantId } : {}),
          },
        });

        return createdItems;
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
          error instanceof Error &&
          (error.message.includes("Akses ditolak") ||
            error.message.includes("tidak memiliki akses"))
            ? "FORBIDDEN"
            : error instanceof Error &&
                (error.message.includes("wajib") ||
                  error.message.includes("harus") ||
                  error.message.includes("Stok") ||
                  error.message.includes("Data stok") ||
                  error.message.includes("Kondisi"))
              ? "VALIDATION_ERROR"
              : error instanceof Error &&
                  error.message.includes("tidak ditemukan")
                ? "NOT_FOUND"
                : "INTERNAL_ERROR",
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
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);

      const comment = await this.repository.addComment(
        workOrderId,
        message,
        userContext.id,
      );

      await WorkOrderEventDispatcher.onActivity({
        workOrderId,
        activityId: (comment as { id: string }).id,
        activityType: "comment",
        message,
        triggeredBy: userContext.id,
      }).catch((err) =>
        logger.error(
          "Failed to publish WORK_ORDER_ACTIVITY event",
          err instanceof Error ? err : undefined,
        ),
      );

      return { success: true, data: comment };
    } catch (error) {
      logger.error(
        "Gagal menambahkan komentar",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menambahkan komentar",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "OPERATION_FAILED",
      };
    }
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
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);

      const task = await this.repository.addTask({
        workOrderId,
        title: taskData.title,
        ...(taskData.description && { description: taskData.description }),
        ...(taskData.order !== undefined && { order: taskData.order }),
      });
      return { success: true, data: task };
    } catch (error) {
      logger.error(
        "Gagal menambahkan tugas",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menambahkan tugas",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "OPERATION_FAILED",
      };
    }
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
    try {
      await this.validateWorkOrderAccess(workOrderId, userContext);

      const attachment = await this.repository.addAttachment(
        workOrderId,
        data.fileName,
        data.filePath,
        data.fileSize,
        data.fileType,
        data.caption,
        userContext.id,
      );

      await invalidateWorkOrderCaches();

      return { success: true, data: attachment };
    } catch (error) {
      logger.error(
        "WorkOrderService.addAttachment failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menambahkan lampiran",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "UPLOAD_ERROR",
      };
    }
  }

  /**
   * Delete attachment from work order
   */
  async deleteAttachment(
    workOrderId: string,
    attachmentId: string,
    userContext: UserContext,
  ): Promise<ServiceResult<void>> {
    try {
      // Validate access
      await this.validateWorkOrderAccess(workOrderId, userContext);

      // Check if attachment exists and belongs to work order
      const workOrder = await this.repository.findById(workOrderId);
      if (!workOrder) {
        return {
          success: false,
          error: "Work order tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      const attachment = workOrder.attachments?.find(
        (a) => a.id === attachmentId,
      );
      if (!attachment) {
        return {
          success: false,
          error: "Lampiran tidak ditemukan pada work order ini",
          code: "NOT_FOUND",
        };
      }

      await this.repository.deleteAttachment(attachmentId, userContext.id);

      await invalidateWorkOrderCaches();

      return { success: true };
    } catch (error) {
      logger.error(
        "WorkOrderService.deleteAttachment failed",
        error instanceof Error ? error : undefined,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Gagal menghapus lampiran",
        code:
          error instanceof Error && error.message.includes("Akses ditolak")
            ? "FORBIDDEN"
            : "DELETE_ERROR",
      };
    }
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
