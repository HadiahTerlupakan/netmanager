import { Prisma } from "@prisma/client";
import type {
  WorkOrderAssignments,
  WorkOrderAttachments,
  WorkOrders,
  WorkOrderStatus,
  WorkOrderTasks,
  WorkOrderUpdates,
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
  StaleReminderWorkOrder,
} from "../domain/ports/IWorkOrderRepository";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import {
  createWorkOrderRecord,
  generateNextWorkOrderNumber,
} from "./work-order-repository-create";
import {
  approveWorkOrderRequest,
  createWorkOrderRequest,
  findAllWorkOrderRequests,
  rejectWorkOrderRequest,
} from "./work-order-repository-request-actions";
import {
  addWorkOrderAttachment,
  deleteWorkOrderAttachment,
} from "./work-order-repository-attachments";
import {
  findAllWorkOrders,
  findAllWorkOrdersForList,
  findStaleReminderWorkOrders,
  findWorkOrderById,
  findWorkOrderByNumber,
  updateWorkOrderRecord,
  updateWorkOrderStatus,
} from "./work-order-repository-core";
import { WorkOrderActivityRepository } from "./WorkOrderActivityRepository";
import { WorkOrderReportingRepository } from "./WorkOrderReportingRepository";
type PrismaInstance = typeof defaultPrisma;
export class WorkOrderRepository
  extends WorkOrderReportingRepository
  implements IWorkOrderRepository
{
  private readonly activityRepository: WorkOrderActivityRepository;

  constructor(
    protected override readonly prisma: PrismaInstance = defaultPrisma,
  ) {
    super(prisma);
    this.activityRepository = new WorkOrderActivityRepository(this.prisma, () =>
      this.getTenantWhere(),
    );
  }
  /** Ambil filter tenant isolation dari request context. */
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
    return findWorkOrderById({ prisma: this.prisma, id, tenantWhere });
  }
  async findByWorkOrderNumber(
    workOrderNumber: string,
  ): Promise<WorkOrderWithRelations | null> {
    const tenantWhere = await this.getTenantWhere();
    return findWorkOrderByNumber({
      prisma: this.prisma,
      workOrderNumber,
      tenantWhere,
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
    return findAllWorkOrders({
      prisma: this.prisma,
      tenantWhere,
      filters,
      page,
      limit,
    });
  }
  async findAllForList(
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    workOrders: import("../domain/ports/IWorkOrderRepository").WorkOrderListItem[];
    total: number;
    page: number;
    totalPages: number;
    summary: import("../domain/ports/IWorkOrderRepository").WorkOrderListSummary;
  }> {
    const tenantWhere = await this.getTenantWhere();
    return findAllWorkOrdersForList({
      prisma: this.prisma,
      tenantWhere,
      filters,
      page,
      limit,
    });
  }
  async findStaleReminderWorkOrders(
    now: Date,
  ): Promise<StaleReminderWorkOrder[]> {
    const tenantWhere = await this.getTenantWhere();
    return findStaleReminderWorkOrders({
      prisma: this.prisma,
      tenantWhere,
      now,
    });
  }
  async update(id: string, data: UpdateWorkOrderData): Promise<WorkOrders> {
    const tenantWhere = await this.getTenantWhere();
    return updateWorkOrderRecord({
      prisma: this.prisma,
      id,
      tenantWhere,
      data,
    });
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
    if (!workOrder) throw new Error("Work order not found");

    return updateWorkOrderStatus({
      workOrder,
      status,
      userId,
      timestamp,
      addUpdate: (data) => this.addUpdate(data),
      update: (workOrderId, data) => this.update(workOrderId, data),
    });
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
  async createRequest(
    data: CreateWorkOrderData & { requestedById: string },
  ): Promise<WorkOrders> {
    return createWorkOrderRequest({ prisma: this.prisma, data });
  }
  async approveRequest(id: string, approvedById: string): Promise<WorkOrders> {
    return approveWorkOrderRequest({
      prisma: this.prisma,
      id,
      approvedById,
      workOrder: await this.findById(id),
      addUpdate: (data) => this.addUpdate(data),
    });
  }
  async rejectRequest(
    id: string,
    rejectedById: string,
    reason: string,
  ): Promise<WorkOrders> {
    return rejectWorkOrderRequest({
      prisma: this.prisma,
      id,
      rejectedById,
      reason,
      workOrder: await this.findById(id),
      addUpdate: (data) => this.addUpdate(data),
    });
  }
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
    return findAllWorkOrderRequests({
      prisma: this.prisma,
      filters,
      page,
      limit,
    });
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
    return addWorkOrderAttachment({
      activityRepository: this.activityRepository,
      addUpdate: (data) => this.addUpdate(data),
      workOrderId,
      fileName,
      filePath,
      fileSize,
      fileType,
      caption,
      uploadedById,
    });
  }

  async deleteAttachment(
    attachmentId: string,
    deletedById?: string,
  ): Promise<void> {
    await deleteWorkOrderAttachment({
      activityRepository: this.activityRepository,
      addUpdate: (data) => this.addUpdate(data),
      attachmentId,
      deletedById,
    });
  }
  async addComment(
    workOrderId: string,
    message: string,
    userId: string,
  ): Promise<WorkOrderUpdates> {
    return this.activityRepository.addComment(workOrderId, message, userId);
  }
}
