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
import { prisma as defaultPrisma } from "@/lib/prisma";
import { buildWorkOrderWhere } from "./work-order-query-builders";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  createWorkOrderRecord,
  createWorkOrderRequestRecord,
  generateNextWorkOrderNumber,
} from "./work-order-repository-create";
import {
  approveRequestedWorkOrder,
  findRequestedWorkOrders,
  rejectRequestedWorkOrder,
} from "./work-order-repository-requests";
import { getWorkOrderStatisticsCore } from "./work-order-repository-statistics-core";
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
import { WorkOrderActivityRepository } from "./WorkOrderActivityRepository";
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
  private readonly activityRepository: WorkOrderActivityRepository;

  constructor(private prisma: PrismaInstance = defaultPrisma) {
    this.activityRepository = new WorkOrderActivityRepository(this.prisma, () =>
      this.getTenantWhere(),
    );
  }
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
    return generateNextWorkOrderNumber(this.prisma, tenantId);
  }
  async create(data: CreateWorkOrderData): Promise<WorkOrders> {
    return createWorkOrderRecord(this.prisma, data) as Promise<WorkOrders>;
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
    return createWorkOrderRequestRecord(
      this.prisma,
      data,
    ) as Promise<WorkOrders>;
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
    const result = await approveRequestedWorkOrder(
      this.prisma,
      id,
      approvedById,
    );
    await this.addUpdate({
      workOrderId: id,
      updateType: "STATUS_CHANGE",
      message: "WO Request disetujui oleh Admin",
      oldStatus: "REQUESTED",
      newStatus: "PENDING",
      createdById: approvedById,
    });
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
    const result = await rejectRequestedWorkOrder(
      this.prisma,
      id,
      rejectedById,
      reason,
    );
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
    return findRequestedWorkOrders(this.prisma, filters, page, limit);
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
    return this.activityRepository.addAssignment(workOrderId, userId, role);
  }
  async removeAssignment(assignmentId: string): Promise<void> {
    await this.activityRepository.removeAssignment(assignmentId);
  }
  async addTask(data: CreateTaskData): Promise<WorkOrderTasks> {
    return this.activityRepository.addTask(data);
  }
  async updateTask(
    taskId: string,
    data: UpdateTaskData,
  ): Promise<WorkOrderTasks> {
    return this.activityRepository.updateTask(taskId, data);
  }
  async deleteTask(taskId: string): Promise<void> {
    await this.activityRepository.deleteTask(taskId);
  }
  async completeTask(taskId: string, userId: string): Promise<WorkOrderTasks> {
    return this.updateTask(taskId, {
      status: "COMPLETED",
      completedById: userId,
    });
  }
  async addUpdate(data: AddUpdateData): Promise<WorkOrderUpdates> {
    return this.activityRepository.addUpdate(data);
  }
  async getUpdates(workOrderId: string): Promise<WorkOrderUpdates[]> {
    return this.activityRepository.getUpdates(workOrderId);
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
    return this.activityRepository.addAttachment(
      {
        workOrderId,
        fileName,
        filePath,
        fileSize,
        fileType,
        caption,
        uploadedById,
      },
      (data) => this.addUpdate(data),
    );
  }
  async deleteAttachment(
    attachmentId: string,
    deletedById?: string,
  ): Promise<void> {
    await this.activityRepository.deleteAttachment(
      attachmentId,
      deletedById,
      (data) => this.addUpdate(data),
    );
  }
  async getStatistics(
    filters?: Omit<WorkOrderFilters, "search">,
    tenantId?: string,
  ): Promise<WorkOrderStatistics> {
    return getWorkOrderStatisticsCore({
      prisma: this.prisma,
      filters,
      tenantId,
    });
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
    return this.activityRepository.addComment(workOrderId, message, userId);
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
