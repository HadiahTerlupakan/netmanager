import type { WorkOrders, WorkOrderStatus } from "@prisma/client";
import type {
  IWorkOrderRepository,
  WorkOrderWithRelations,
  CreateWorkOrderData,
  UpdateWorkOrderData,
  AddUpdateData,
  WorkOrderFilters,
  StaleReminderWorkOrder,
} from "../domain/ports/IWorkOrderRepository";
import { prisma as defaultPrisma } from "@/lib/prisma";
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
  findAllWorkOrders,
  findAllWorkOrdersForList,
  findStaleReminderWorkOrders,
  findWorkOrderById,
  findWorkOrderByNumber,
  updateWorkOrderRecord,
  updateWorkOrderStatus,
} from "./work-order-repository-core";
import { WorkOrderScopedRepository } from "./WorkOrderScopedRepository";

type PrismaInstance = typeof defaultPrisma;

export class WorkOrderRepository
  extends WorkOrderScopedRepository
  implements IWorkOrderRepository
{
  constructor(
    protected override readonly prisma: PrismaInstance = defaultPrisma,
  ) {
    super(prisma);
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
      update: (workOrderId, nextData) => this.update(workOrderId, nextData),
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
    const data: Record<string, unknown> = { status: "COMPLETED" };
    if (resolutionNotes) {
      data.resolutionNotes = resolutionNotes;
    }
    await this.updateStatus(id, "COMPLETED", userId, timestamp);
    return this.update(id, data);
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
}
