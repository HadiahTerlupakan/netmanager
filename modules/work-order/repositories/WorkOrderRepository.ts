import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";
import type {
  WorkOrders,
  WorkOrderTasks,
  WorkOrderAssignments,
  WorkOrderUpdates,
  WorkOrderAttachments,
  WorkOrderStatus,
  WorkOrderType,
} from "@prisma/client";
import type {
  IWorkOrderRepository,
  WorkOrderWithRelations,
  CreateWorkOrderData,
  UpdateWorkOrderData,
  CreateTaskData,
  UpdateTaskData,
  AddUpdateData,
  WorkOrderFilters,
  WorkOrderStatistics,
  TopPerformer,
} from "./IWorkOrderRepository";
import { buildWorkOrderListSummary } from "../utils/work-order-list-summary";
import { validateStatusTransition } from "../utils/status-transitions";
import { randomUUID } from "crypto";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildWorkOrderWhere } from "./work-order-query-builders";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  WORK_ORDER_ASSIGNMENTS_INCLUDE,
  WORK_ORDER_CUSTOMER_SELECT,
  WORK_ORDER_DEPARTMENT_SELECT,
  WORK_ORDER_DETAIL_INCLUDE,
  WORK_ORDER_LIST_SELECT,
  WORK_ORDER_LIST_SUMMARY_SELECT,
  WORK_ORDER_UPDATES_INCLUDE,
  WORK_ORDER_ASSIGNEE_SELECT,
} from "./work-order-repository-selects";
import {
  getAdminKPIStats,
  getAdminResponseStats,
  getIssueTrend,
  getPerformanceTrend,
  getTypeTrend,
  getVolumeTrend,
} from "./work-order-repository-analytics";
import {
  getDisconnectionStatistics,
  getIssueStatistics,
  getSiteStatistics,
} from "./work-order-repository-statistics";
import {
  addAssignment,
  addAttachment,
  addUpdate,
  addTask,
  deleteAttachment,
  deleteTask,
  getUpdates,
  removeAssignment,
  updateTask,
} from "./work-order-repository-activity";
import {
  getDepartmentWorkload,
  getEmployeeDepartmentWorkOrders,
  getRecentWorkOrders,
} from "./work-order-repository-dashboard";
import {
  getSiteStatsByType,
  getTopAssists,
  getTopPerformers,
  getUserWorkOrderStats,
} from "./work-order-repository-performance";
type PrismaInstance = typeof defaultPrisma;
export class WorkOrderRepository implements IWorkOrderRepository {
  constructor(private prisma: PrismaInstance = defaultPrisma) {}
  /**
   * Helper to get tenant isolation filter based on current context.
   * Prevents cross-tenant data leakage (IDOR protection at Repo level).
   */
  private async getTenantWhere(): Promise<Prisma.WorkOrdersWhereInput> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return {};
    if (!tenantId) return { tenantId: "___MISSING_TENANT_ID___" };
    return { tenantId };
  }
  async generateWorkOrderNumber(tenantId?: string): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    // Get tenantId from context if not provided
    let effectiveTenantId = tenantId;
    if (!effectiveTenantId) {
      const context = await getTenantIdFromContext();
      effectiveTenantId = context.tenantId || undefined;
    }
    // Get the highest sequence number for today instead of just count
    // This handles deleted records and race conditions better
    const lastWo = await this.prisma.workOrders.findFirst({
      where: {
        tenantId: effectiveTenantId,
        workOrderNumber: {
          startsWith: `WO-${dateStr}-`,
        },
      },
      orderBy: {
        workOrderNumber: "desc",
      },
      select: {
        workOrderNumber: true,
      },
    });
    let nextSequence = 1;
    if (lastWo?.workOrderNumber) {
      // Extract the sequence part: WO-YYYYMMDD-XXXX -> XXXX
      const parts = (lastWo?.workOrderNumber ?? "").split("-");
      if (parts.length >= 3) {
        const lastSequence = parseInt(parts[2] || "0", 10);
        if (!isNaN(lastSequence)) {
          nextSequence = lastSequence + 1;
        }
      }
    }
    const sequence = nextSequence.toString().padStart(4, "0");
    return `WO-${dateStr}-${sequence}`;
  }
  async create(data: CreateWorkOrderData): Promise<WorkOrders> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Determine tenantId for generation
        const { tenantId: dataTenantId } = data as { tenantId?: string };
        let generationTenantId = dataTenantId;
        if (!generationTenantId) {
          const context = await getTenantIdFromContext();
          generationTenantId = context.tenantId || undefined;
        }
        const workOrderNumber =
          await this.generateWorkOrderNumber(generationTenantId);
        // Destructure pelangganId to handle it separately
        const { pelangganId, ...restData } = data;
        const persistedTenantId = generationTenantId ?? null;
        const result = await this.prisma.workOrders.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            workOrderNumber,
            tenantId: persistedTenantId,
            type: restData.type,
            title: restData.title,
            description: restData.description,
            status: "PENDING",
            priority: data.priority || "NORMAL",
            createdById: data.createdById ?? null,
            pelangganId: pelangganId || null,
            siteId: restData.siteId || null,
            departmentId: restData.departmentId || null,
            assignedToId: restData.assignedToId || null,
            contactName: restData.contactName ?? null,
            contactPhone: restData.contactPhone ?? null,
            locationAddress: restData.locationAddress ?? null,
            scheduledDate: restData.scheduledDate ?? null,
            scheduledTimeStart: restData.scheduledTimeStart ?? null,
            scheduledTimeEnd: restData.scheduledTimeEnd ?? null,
            estimatedHours: restData.estimatedHours ?? null,
            estimatedCost: restData.estimatedCost ?? null,
            requiredMaterials:
              restData.requiredMaterials as Prisma.InputJsonValue,
            internalNotes: restData.internalNotes ?? null,
            disconnectionReason: restData.disconnectionReason || null,
            isInternal: restData.isInternal || false, // Internal FOC flag
          },
        });
        // NOTE: Notification moved to Service layer to avoid duplication
        // and resolve "Cannot find name notifyNewWorkOrder" error
        return result;
      } catch (error: unknown) {
        // Check if this is a unique constraint violation on workOrderNumber
        const prismaError = error as {
          code?: string;
          meta?: { target?: string[] };
        };
        if (
          prismaError?.code === "P2002" &&
          prismaError?.meta?.target?.includes("workOrderNumber")
        ) {
          logger.warn(
            `[WorkOrderRepo] Unique constraint violation on workOrderNumber, retry attempt ${attempt + 1}/${MAX_RETRIES}`,
          );
          if (error instanceof Error) {
            lastError = error;
          } else {
            lastError = new Error(String(error));
          }
          // Wait a bit before retrying with exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * Math.pow(2, attempt)),
          );
          continue;
        }
        // For other errors, throw immediately
        throw error;
      }
    }
    // If all retries failed, throw the last error
    logger.error(
      "[WorkOrderRepo] Failed to create work order after all retries",
    );
    throw (
      lastError || new Error("Failed to create work order after max retries")
    );
  }
  async findById(id: string): Promise<WorkOrderWithRelations | null> {
    const tenantWhere = await this.getTenantWhere();
    const result = await this.prisma.workOrders.findFirst({
      where: { id, ...tenantWhere },
      include: WORK_ORDER_DETAIL_INCLUDE,
    });
    return result;
  }
  async findByWorkOrderNumber(
    workOrderNumber: string,
  ): Promise<WorkOrderWithRelations | null> {
    const tenantWhere = await this.getTenantWhere();
    return this.prisma.workOrders.findFirst({
      where: { workOrderNumber, ...tenantWhere },
      include: {
        pelanggan: { select: WORK_ORDER_CUSTOMER_SELECT },
        department: { select: WORK_ORDER_DEPARTMENT_SELECT },
        assignedTo: { select: WORK_ORDER_ASSIGNEE_SELECT },
        tasks: { orderBy: { order: "asc" } },
        assignments: WORK_ORDER_ASSIGNMENTS_INCLUDE,
        updates: WORK_ORDER_UPDATES_INCLUDE,
        attachments: { orderBy: { uploadedAt: "desc" } },
      },
    });
  }
  async findAll(
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    workOrders: WorkOrderWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const tenantWhere = await this.getTenantWhere();
    const where = buildWorkOrderWhere({ tenantWhere, filters });
    const [workOrders, total] = await Promise.all([
      this.prisma.workOrders.findMany({
        where,
        include: {
          pelanggan: {
            select: {
              id: true,
              idPelanggan: true,
              nama: true,
              email: true,
              noTelp: true,
            },
          },
          site: { select: { id: true, name: true, code: true } },
          department: { select: WORK_ORDER_DEPARTMENT_SELECT },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: { select: { isTechnical: true } },
            },
          },
          tasks: true,
          assignments: WORK_ORDER_ASSIGNMENTS_INCLUDE,
          updates: WORK_ORDER_UPDATES_INCLUDE,
          attachments: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workOrders.count({ where }),
    ]);
    return {
      workOrders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
  /**
   * Optimized query for list views - only fetches essential fields
   * Reduces data transfer by ~90% compared to findAll()
   * Does NOT fetch: tasks, assignments, updates, attachments
   */
  async findAllForList(
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    workOrders: import("./IWorkOrderRepository").WorkOrderListItem[];
    total: number;
    page: number;
    totalPages: number;
    summary: import("./IWorkOrderRepository").WorkOrderListSummary;
  }> {
    const tenantWhere = await this.getTenantWhere();
    const where = buildWorkOrderWhere({ tenantWhere, filters });
    // OPTIMIZED: Use select instead of include - only fetch fields needed for list view
    const [workOrders, total, summaryRows] = await Promise.all([
      this.prisma.workOrders.findMany({
        where,
        select: WORK_ORDER_LIST_SELECT,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workOrders.count({ where }),
      this.prisma.workOrders.findMany({
        where,
        select: WORK_ORDER_LIST_SUMMARY_SELECT,
      }),
    ]);
    const summary = buildWorkOrderListSummary(summaryRows);
    return {
      workOrders:
        workOrders as import("./IWorkOrderRepository").WorkOrderListItem[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary,
    };
  }
  async update(id: string, data: UpdateWorkOrderData): Promise<WorkOrders> {
    const tenantWhere = await this.getTenantWhere();
    const result = await this.prisma.workOrders.updateMany({
      where: { id, ...tenantWhere },
      data: {
        ...data,
        updatedAt: new Date(),
      } as Prisma.WorkOrdersUncheckedUpdateInput,
    });
    if (result.count === 0) {
      throw new Error("Work order not found or access denied");
    }
    return this.prisma.workOrders.findUnique({
      where: { id },
    }) as Promise<WorkOrders>;
  }
  async delete(id: string): Promise<void> {
    const tenantWhere = await this.getTenantWhere();
    const result = await this.prisma.workOrders.deleteMany({
      where: { id, ...tenantWhere },
    });
    if (result.count === 0) {
      throw new Error("Work order not found or access denied");
    }
  }
  async updateStatus(
    id: string,
    status: WorkOrderStatus,
    userId?: string,
    timestamp?: Date,
  ): Promise<WorkOrders> {
    const workOrder = await this.findById(id);
    if (!workOrder) {
      throw new Error("Work order not found");
    }
    // CRITICAL: Validate status transition
    validateStatusTransition(workOrder.status, status);
    const woUpdateData: Record<string, unknown> = { status };
    const eventTime = timestamp || new Date();
    if (status === "IN_PROGRESS" && !workOrder.startedAt) {
      woUpdateData.startedAt = eventTime;
    } else if (status === "COMPLETED") {
      woUpdateData.completedAt = eventTime;
      if (workOrder.startedAt) {
        const hours =
          (eventTime.getTime() - new Date(workOrder.startedAt).getTime()) /
          (1000 * 60 * 60);
        woUpdateData.actualHours = hours;
      }
    } else if (status === "VERIFIED") {
      woUpdateData.verifiedAt = eventTime;
    } else if (status === "CLOSED") {
      woUpdateData.closedAt = eventTime;
    }
    const statusUpdateData: AddUpdateData = {
      workOrderId: id,
      updateType: "STATUS_CHANGE",
      message: `Status changed from ${workOrder.status} to ${status}`,
      oldStatus: workOrder.status as WorkOrderStatus,
      newStatus: status as WorkOrderStatus,
    };
    if (userId) {
      statusUpdateData.createdById = userId;
    }
    await this.addUpdate(statusUpdateData);
    const updatedWo = await this.update(id, woUpdateData);
    // NOTE: Side effects live in Service/route layer to avoid repository coupling
    return updatedWo;
  }
  async start(
    id: string,
    userId?: string,
    timestamp?: Date,
  ): Promise<WorkOrders> {
    return this.updateStatus(id, "IN_PROGRESS", userId, timestamp);
  }
  async complete(
    id: string,
    resolutionNotes?: string,
    userId?: string,
    timestamp?: Date,
  ): Promise<WorkOrders> {
    const updateData: Record<string, unknown> = { status: "COMPLETED" };
    if (resolutionNotes) {
      updateData.resolutionNotes = resolutionNotes;
    }
    await this.updateStatus(id, "COMPLETED", userId, timestamp);
    return this.update(id, updateData);
  }
  async verify(id: string, userId?: string): Promise<WorkOrders> {
    return this.updateStatus(id, "VERIFIED", userId);
  }
  async close(id: string, userId?: string): Promise<WorkOrders> {
    return this.updateStatus(id, "CLOSED", userId);
  }
  async cancel(
    id: string,
    reason: string,
    userId?: string,
  ): Promise<WorkOrders> {
    const updateData: AddUpdateData = {
      workOrderId: id,
      updateType: "NOTE",
      message: `Work order cancelled. Reason: ${reason}`,
    };
    if (userId) {
      updateData.createdById = userId;
    }
    await this.addUpdate(updateData);
    return this.updateStatus(id, "CANCELLED", userId);
  }
  /**
   * Create a Work Order Request from Mobile App
   * Status will be REQUESTED (waiting for approval)
   */
  async createRequest(
    data: CreateWorkOrderData & { requestedById: string },
  ): Promise<WorkOrders> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const { tenantId: contextTenantId } = await getTenantIdFromContext();
        const persistedTenantId = data.tenantId ?? contextTenantId ?? null;
        const workOrderNumber = await this.generateWorkOrderNumber(
          persistedTenantId ?? undefined,
        );
        const { pelangganId, requestedById, ...restData } = data;
        const result = await this.prisma.workOrders.create({
          data: {
            id: randomUUID(),
            updatedAt: new Date(),
            workOrderNumber,
            tenantId: persistedTenantId,
            type: restData.type,
            title: restData.title,
            description: restData.description,
            status: "REQUESTED", // Status menunggu approval
            priority: data.priority || "NORMAL",
            createdById: requestedById, // Same as requester for mobile requests
            requestedById: requestedById,
            requestedAt: new Date(),
            pelangganId: pelangganId || null,
            siteId: restData.siteId || null,
            departmentId: restData.departmentId || null,
            assignedToId: null, // Not assigned yet
            contactName: restData.contactName ?? null,
            contactPhone: restData.contactPhone ?? null,
            locationAddress: restData.locationAddress ?? null,
            locationLat: restData.locationLat ?? null,
            locationLng: restData.locationLng ?? null,
            scheduledDate: restData.scheduledDate ?? null,
            internalNotes: restData.internalNotes ?? null,
            isInternal: restData.isInternal || false, // Internal FOC flag
          },
        });
        // NOTE: We do NOT notify department users here
        // Only notify admins with approval permission (handled in route)
        return result;
      } catch (error: unknown) {
        const prismaError = error as {
          code?: string;
          meta?: { target?: string[] };
        };
        if (
          prismaError?.code === "P2002" &&
          prismaError?.meta?.target?.includes("workOrderNumber")
        ) {
          logger.warn(
            `[WorkOrderRepo] Unique constraint violation on workOrderNumber, retry attempt ${attempt + 1}/${MAX_RETRIES}`,
          );
          lastError = error instanceof Error ? error : new Error(String(error));
          await new Promise((resolve) =>
            setTimeout(resolve, 50 * Math.pow(2, attempt)),
          );
          continue;
        }
        throw error;
      }
    }
    logger.error(
      "[WorkOrderRepo] Failed to create work order request after all retries",
    );
    throw (
      lastError ||
      new Error("Failed to create work order request after max retries")
    );
  }
  /**
   * Approve a Work Order Request
   * Changes status from REQUESTED to PENDING
   */
  async approveRequest(id: string, approvedById: string): Promise<WorkOrders> {
    const workOrder = await this.findById(id);
    if (!workOrder) {
      throw new Error("Work order not found");
    }
    if (workOrder.status !== "REQUESTED") {
      throw new Error(
        `Cannot approve: Work order status is ${workOrder.status}, expected REQUESTED`,
      );
    }
    const result = await this.prisma.workOrders.update({
      where: { id },
      data: {
        status: "PENDING",
        approvedById: approvedById,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await this.addUpdate({
      workOrderId: id,
      updateType: "STATUS_CHANGE",
      message: "WO Request disetujui oleh Admin",
      oldStatus: "REQUESTED",
      newStatus: "PENDING",
      createdById: approvedById,
    });
    // NOTE: Notification moved to Service layer
    return result;
  }
  /**
   * Reject a Work Order Request
   * Changes status from REQUESTED to CANCELLED with rejection reason
   */
  async rejectRequest(
    id: string,
    rejectedById: string,
    reason: string,
  ): Promise<WorkOrders> {
    const workOrder = await this.findById(id);
    if (!workOrder) {
      throw new Error("Work order not found");
    }
    if (workOrder.status !== "REQUESTED") {
      throw new Error(
        `Cannot reject: Work order status is ${workOrder.status}, expected REQUESTED`,
      );
    }
    const result = await this.prisma.workOrders.update({
      where: { id },
      data: {
        status: "CANCELLED",
        approvedById: rejectedById, // Admin who rejected
        approvedAt: new Date(),
        rejectionReason: reason,
        updatedAt: new Date(),
      },
    });
    await this.addUpdate({
      workOrderId: id,
      updateType: "STATUS_CHANGE",
      message: `WO Request ditolak: ${reason}`,
      oldStatus: "REQUESTED",
      newStatus: "CANCELLED",
      createdById: rejectedById,
    });
    return result;
  }
  /**
   * Find all Work Order Requests (status = REQUESTED)
   */
  async findAllRequests(
    filters?: { departmentId?: string; siteId?: string; search?: string },
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    workOrders: WorkOrderWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const where: Record<string, unknown> = {
      status: "REQUESTED",
    };
    if (filters?.departmentId) {
      where.departmentId = filters.departmentId;
    }
    if (filters?.siteId) {
      where.siteId = filters.siteId;
    }
    if (filters?.search) {
      where.OR = [
        { workOrderNumber: { contains: filters.search, mode: "insensitive" } },
        { title: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const [workOrders, total] = await Promise.all([
      this.prisma.workOrders.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, code: true } },
          department: { select: { id: true, name: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.workOrders.count({ where }),
    ]);
    return {
      workOrders: workOrders as WorkOrderWithRelations[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
  async assign(
    id: string,
    employeeId: string,
    role?: string,
    _triggeredByUserId?: string,
  ): Promise<WorkOrders> {
    await this.update(id, {
      assignedToId: employeeId,
      status: "ASSIGNED",
    });
    await this.addAssignment(id, employeeId, role || "Lead");
    return (await this.findById(id)) as WorkOrders;
  }
  async unassign(id: string): Promise<WorkOrders> {
    return this.prisma.workOrders.update({
      where: { id },
      data: {
        assignedToId: null,
        status: "PENDING",
      },
    });
  }
  async addAssignment(
    workOrderId: string,
    userId: string,
    role?: string,
  ): Promise<WorkOrderAssignments> {
    return addAssignment(
      this.prisma,
      () => this.getTenantWhere(),
      workOrderId,
      userId,
      role,
    );
  }
  async removeAssignment(assignmentId: string): Promise<void> {
    await removeAssignment(
      this.prisma,
      () => this.getTenantWhere(),
      assignmentId,
    );
  }
  async addTask(data: CreateTaskData): Promise<WorkOrderTasks> {
    return addTask(this.prisma, () => this.getTenantWhere(), data);
  }
  async updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<WorkOrderTasks> {
    return updateTask(this.prisma, () => this.getTenantWhere(), taskId, data);
  }
  async deleteTask(taskId: string): Promise<void> {
    await deleteTask(this.prisma, () => this.getTenantWhere(), taskId);
  }
  async completeTask(taskId: string, userId: string): Promise<WorkOrderTasks> {
    return this.updateTask(taskId, {
      status: "COMPLETED",
      completedById: userId,
    });
  }
  async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates> {
    return addUpdate(this.prisma, data);
  }
  async getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]> {
    return getUpdates(this.prisma, () => this.getTenantWhere(), workOrderId);
  }
  async addAttachment(
    workOrderId: string,
    fileName: string,
    filePath: string,
    fileSize: number,
    fileType: string,
    caption?: string,
    uploadedById?: string,
  ): Promise<WorkOrderAttachments> {
    return addAttachment(
      this.prisma,
      () => this.getTenantWhere(),
      (data) => this.addUpdate(data),
      workOrderId,
      fileName,
      filePath,
      fileSize,
      fileType,
      caption,
      uploadedById,
    );
  }
  async deleteAttachment(
    attachmentId: string,
    deletedById?: string,
  ): Promise<void> {
    await deleteAttachment(
      this.prisma,
      () => this.getTenantWhere(),
      (data) => this.addUpdate(data),
      attachmentId,
      deletedById,
    );
  }
  async getStatistics(
    filters?: Omit<WorkOrderFilters, "search">,
    tenantId?: string,
  ): Promise<WorkOrderStatistics> {
    const where: Prisma.WorkOrdersWhereInput = {};
    if (filters?.siteId) where.siteId = filters.siteId;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.assignedToId !== undefined)
      where.assignedToId = filters.assignedToId;
    if (filters?.pelangganId) where.pelangganId = filters.pelangganId;
    if (filters?.dateFrom || filters?.dateTo) {
      const createdAtFilter: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) createdAtFilter.gte = filters.dateFrom;
      if (filters.dateTo) createdAtFilter.lte = filters.dateTo;
      where.createdAt = createdAtFilter;
    }
    // Prepare conditions for raw query
    // MANUALLY handle tenant isolation for raw query
    const { tenantId: contextTenantId, isSuperAdmin } =
      await getTenantIdFromContext();
    const effectiveTenantId =
      tenantId ??
      (!isSuperAdmin && !contextTenantId
        ? "___MISSING_TENANT_ID___"
        : contextTenantId);
    if (effectiveTenantId) {
      where.tenantId = effectiveTenantId;
    }
    let query = Prisma.sql`
            SELECT
                AVG(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 3600)::float as "avgHours",
                SUM("actualCost")::float as "totalCost"
            FROM "work_orders"
            WHERE "completedAt" IS NOT NULL
            AND "startedAt" IS NOT NULL
        `;
    if (effectiveTenantId) {
      query = Prisma.sql`${query} AND "tenantId" = ${effectiveTenantId}`;
    }
    if (filters?.siteId)
      query = Prisma.sql`${query} AND "siteId" = ${filters.siteId}`;
    if (filters?.departmentId)
      query = Prisma.sql`${query} AND "departmentId" = ${filters.departmentId}`;
    if (filters?.assignedToId)
      query = Prisma.sql`${query} AND "assignedToId" = ${filters.assignedToId}`;
    if (filters?.pelangganId)
      query = Prisma.sql`${query} AND "pelangganId" = ${filters.pelangganId}`;
    if (filters?.dateFrom)
      query = Prisma.sql`${query} AND "createdAt" >= ${filters.dateFrom}`;
    if (filters?.dateTo)
      query = Prisma.sql`${query} AND "createdAt" <= ${filters.dateTo}`;
    const [total, statusCounts, completionStats, ratingData, urgentOpen] =
      await Promise.all([
        this.prisma.workOrders.count({ where }),
        this.prisma.workOrders.groupBy({
          by: ["status"],
          where,
          _count: true,
        }),
        // Optimized aggregation for cost and duration
        this.prisma.$queryRaw<{ avgHours: number; totalCost: number }[]>(query),
        this.prisma.workOrders.aggregate({
          where: {
            ...where,
            rating: { not: null },
          },
          _avg: {
            rating: true,
          },
          _count: {
            rating: true,
          },
        }),
        this.prisma.workOrders.count({
          where: {
            ...where,
            priority: { in: ["HIGH", "URGENT", "CRITICAL"] },
            status: { notIn: ["COMPLETED", "VERIFIED", "CLOSED", "CANCELLED"] },
          },
        }),
      ]);
    const statusMap = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );
    const stats = completionStats[0] || { avgHours: 0, totalCost: 0 };
    return {
      total,
      pending: statusMap["PENDING"] || 0,
      assigned: statusMap["ASSIGNED"] || 0,
      inProgress: statusMap["IN_PROGRESS"] || 0,
      onHold: statusMap["ON_HOLD"] || 0,
      completed: statusMap["COMPLETED"] || 0,
      verified: statusMap["VERIFIED"] || 0,
      closed: statusMap["CLOSED"] || 0,
      cancelled: statusMap["CANCELLED"] || 0,
      urgentOpen,
      avgCompletionTimeHours: stats.avgHours || 0,
      totalCost: stats.totalCost || 0,
      avgRating: ratingData._avg.rating || null,
      totalWithRating: ratingData._count.rating || 0,
    };
  }
  async getTopPerformers(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
  ): Promise<TopPerformer[]> {
    return getTopPerformers(this.prisma, limit, dateFrom, dateTo, departmentId);
  }
  async getTopAssists(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
  ): Promise<TopPerformer[]> {
    return getTopAssists(this.prisma, limit, dateFrom, dateTo, departmentId);
  }
  async getUserWorkOrderStats(
    dateFrom: Date,
    dateTo: Date,
    tenantId?: string,
  ): Promise<Array<{ userId: string; count: number }>> {
    return getUserWorkOrderStats(
      this.prisma,
      getTenantIdFromContext,
      dateFrom,
      dateTo,
      tenantId,
    );
  }
  async getSiteStatsByType(
    types: WorkOrderType[],
    limit: number,
    dateFrom: Date,
    dateTo: Date,
    tenantId?: string,
  ): Promise<Array<{ siteId: string; siteName: string; count: number }>> {
    return getSiteStatsByType(
      this.prisma,
      getTenantIdFromContext,
      types,
      limit,
      dateFrom,
      dateTo,
      tenantId,
    );
  }
  /**
   * Get recent work orders for dashboard
   */
  async getRecentWorkOrders(
    limit: number = 5,
    filters?: WorkOrderFilters,
  ): Promise<WorkOrderWithRelations[]> {
    return getRecentWorkOrders(this.prisma, limit, filters);
  }
  async getDepartmentWorkload(departmentId?: string) {
    return getDepartmentWorkload(this.prisma, departmentId);
  }
  async getEmployeeDepartmentWorkOrders(
    departmentId: string,
    employeeId: string,
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20,
  ) {
    return getEmployeeDepartmentWorkOrders(
      this.prisma,
      departmentId,
      employeeId,
      filters,
      page,
      limit,
    );
  }
  async getIssueStatistics(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getIssueStatistics(
      this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
    );
  }
  async getSiteStatistics(
    limit: number = 5,
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getSiteStatistics(
      this.prisma,
      limit,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
    );
  }
  async getDisconnectionStatistics(
    dateFrom?: Date,
    dateTo?: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getDisconnectionStatistics(
      this.prisma,
      dateFrom,
      dateTo,
      departmentId,
      siteId,
    );
  }
  async findByIdWithTicketAndAttachments(id: string): Promise<
    | (WorkOrders & {
        ticket: import("@prisma/client").SupportTickets | null;
        attachments: WorkOrderAttachments[];
      })
    | null
  > {
    return this.prisma.workOrders.findUnique({
      where: { id },
      include: {
        ticket: true,
        attachments: true,
      },
    }) as Promise<
      | (WorkOrders & {
          ticket: import("@prisma/client").SupportTickets | null;
          attachments: WorkOrderAttachments[];
        })
      | null
    >;
  }
  async findManyByTicketId(ticketId: string): Promise<WorkOrders[]> {
    return this.prisma.workOrders.findMany({
      where: { ticketId },
    });
  }
  async addComment(
    workOrderId: string,
    message: string,
    userId: string,
  ): Promise<WorkOrderUpdates> {
    return this.prisma.workOrderUpdates.create({
      data: {
        id: randomUUID(),
        workOrderId,
        updateType: "COMMENT",
        message,
        createdById: userId,
      },
    });
  }
  /**
   * Get admin response statistics with detailed KPI per user
   * Calculates: response time, verification metrics, ON_HOLD response metrics per user
   */
  async getAdminResponseStats(
    dateFrom: Date,
    dateTo: Date,
    departmentId?: string,
  ) {
    return getAdminResponseStats(this.prisma, dateFrom, dateTo, departmentId);
  }
  async getAdminKPIStats(departmentId?: string, siteId?: string) {
    return getAdminKPIStats(this.prisma, departmentId, siteId);
  }
  async getVolumeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getVolumeTrend(
      this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    );
  }
  async getIssueTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getIssueTrend(this.prisma, startDate, endDate, departmentId, siteId);
  }
  async getPerformanceTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getPerformanceTrend(
      this.prisma,
      startDate,
      endDate,
      departmentId,
      siteId,
    );
  }
  async getTypeTrend(
    startDate: Date,
    endDate: Date,
    departmentId?: string,
    siteId?: string,
  ) {
    return getTypeTrend(this.prisma, startDate, endDate, departmentId, siteId);
  }
}
