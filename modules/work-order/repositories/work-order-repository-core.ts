import { Prisma } from "@prisma/client";
import type { WorkOrders, WorkOrderStatus } from "@prisma/client";

import { buildWorkOrderListSummary } from "../utils/work-order-list-summary";
import { validateStatusTransition } from "../utils/status-transitions";
import type {
  AddUpdateData,
  UpdateWorkOrderData,
  WorkOrderFilters,
  WorkOrderWithRelations,
} from "./IWorkOrderRepository";
import { buildWorkOrderWhere } from "./work-order-query-builders";
import {
  WORK_ORDER_ASSIGNMENTS_INCLUDE,
  WORK_ORDER_ASSIGNEE_SELECT,
  WORK_ORDER_CUSTOMER_SELECT,
  WORK_ORDER_DEPARTMENT_SELECT,
  WORK_ORDER_DETAIL_INCLUDE,
  WORK_ORDER_LIST_SELECT,
  WORK_ORDER_LIST_SUMMARY_SELECT,
  WORK_ORDER_UPDATES_INCLUDE,
} from "./work-order-repository-selects";

const STALE_WORK_ORDER_LIMIT = 100;
const STALE_WORK_ORDER_AGE_MS = 24 * 60 * 60 * 1000;

type PrismaInstance = typeof import("@/lib/prisma").prisma;

export async function findWorkOrderById(input: {
  prisma: PrismaInstance;
  id: string;
  tenantWhere: Prisma.WorkOrdersWhereInput;
}) {
  return input.prisma.workOrders.findFirst({
    where: { id: input.id, ...input.tenantWhere },
    include: WORK_ORDER_DETAIL_INCLUDE,
  });
}

export async function findWorkOrderByNumber(input: {
  prisma: PrismaInstance;
  workOrderNumber: string;
  tenantWhere: Prisma.WorkOrdersWhereInput;
}): Promise<WorkOrderWithRelations | null> {
  return input.prisma.workOrders.findFirst({
    where: { workOrderNumber: input.workOrderNumber, ...input.tenantWhere },
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

export async function findAllWorkOrders(input: {
  prisma: PrismaInstance;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  filters?: WorkOrderFilters;
  page: number;
  limit: number;
}) {
  const where = buildWorkOrderWhere({
    tenantWhere: input.tenantWhere,
    filters: input.filters,
  });
  const [workOrders, total] = await Promise.all([
    input.prisma.workOrders.findMany({
      where,
      include: buildWorkOrderListInclude(),
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    input.prisma.workOrders.count({ where }),
  ]);

  return buildPagedWorkOrderResult(workOrders, total, input.page, input.limit);
}

export async function findAllWorkOrdersForList(input: {
  prisma: PrismaInstance;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  filters?: WorkOrderFilters;
  page: number;
  limit: number;
}) {
  const where = buildWorkOrderWhere({
    tenantWhere: input.tenantWhere,
    filters: input.filters,
  });
  const [workOrders, total, summaryRows] = await Promise.all([
    input.prisma.workOrders.findMany({
      where,
      select: WORK_ORDER_LIST_SELECT,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    input.prisma.workOrders.count({ where }),
    input.prisma.workOrders.findMany({
      where,
      select: WORK_ORDER_LIST_SUMMARY_SELECT,
    }),
  ]);

  return {
    workOrders:
      workOrders as import("./IWorkOrderRepository").WorkOrderListItem[],
    total,
    page: input.page,
    totalPages: Math.ceil(total / input.limit),
    summary: buildWorkOrderListSummary(summaryRows),
  };
}

export async function findStaleReminderWorkOrders(input: {
  prisma: PrismaInstance;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  now: Date;
}) {
  return input.prisma.workOrders.findMany({
    where: {
      ...input.tenantWhere,
      status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
      createdAt: {
        lte: new Date(input.now.getTime() - STALE_WORK_ORDER_AGE_MS),
      },
    },
    select: {
      id: true,
      workOrderNumber: true,
      title: true,
      type: true,
      priority: true,
      status: true,
      departmentId: true,
      siteId: true,
      assignedToId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: STALE_WORK_ORDER_LIMIT,
  });
}

export async function updateWorkOrderRecord(input: {
  prisma: PrismaInstance;
  id: string;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  data: UpdateWorkOrderData | Record<string, unknown>;
}) {
  const result = await input.prisma.workOrders.updateMany({
    where: { id: input.id, ...input.tenantWhere },
    data: {
      ...input.data,
      updatedAt: new Date(),
    } as Prisma.WorkOrdersUncheckedUpdateInput,
  });

  if (result.count === 0)
    throw new Error("Work order not found or access denied");
  return input.prisma.workOrders.findUnique({
    where: { id: input.id },
  }) as Promise<WorkOrders>;
}

export async function updateWorkOrderStatus(input: {
  workOrder: WorkOrderWithRelations;
  status: WorkOrderStatus;
  userId?: string;
  timestamp?: Date;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
  update: (id: string, data: Record<string, unknown>) => Promise<WorkOrders>;
}) {
  validateStatusTransition(input.workOrder.status, input.status);
  await input.addUpdate(buildStatusUpdateData(input));
  return input.update(input.workOrder.id, buildStatusWorkOrderUpdate(input));
}

function buildWorkOrderListInclude() {
  return {
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
  };
}

function buildPagedWorkOrderResult(
  workOrders: WorkOrderWithRelations[],
  total: number,
  page: number,
  limit: number,
) {
  return { workOrders, total, page, totalPages: Math.ceil(total / limit) };
}

function buildStatusUpdateData(input: {
  workOrder: WorkOrderWithRelations;
  status: WorkOrderStatus;
  userId?: string;
}): AddUpdateData {
  return {
    workOrderId: input.workOrder.id,
    updateType: "STATUS_CHANGE",
    message: `Status changed from ${input.workOrder.status} to ${input.status}`,
    oldStatus: input.workOrder.status as WorkOrderStatus,
    newStatus: input.status as WorkOrderStatus,
    ...(input.userId ? { createdById: input.userId } : {}),
  };
}

function buildStatusWorkOrderUpdate(input: {
  workOrder: WorkOrderWithRelations;
  status: WorkOrderStatus;
  timestamp?: Date;
}) {
  const eventTime = input.timestamp || new Date();
  const updateData: Record<string, unknown> = { status: input.status };
  assignStatusTimestamp(updateData, input.workOrder, input.status, eventTime);
  return updateData;
}

function assignStatusTimestamp(
  updateData: Record<string, unknown>,
  workOrder: WorkOrderWithRelations,
  status: WorkOrderStatus,
  eventTime: Date,
) {
  if (status === "IN_PROGRESS" && !workOrder.startedAt)
    updateData.startedAt = eventTime;
  if (status === "COMPLETED")
    assignCompletionFields(updateData, workOrder, eventTime);
  if (status === "VERIFIED") updateData.verifiedAt = eventTime;
  if (status === "CLOSED") updateData.closedAt = eventTime;
}

function assignCompletionFields(
  updateData: Record<string, unknown>,
  workOrder: WorkOrderWithRelations,
  eventTime: Date,
) {
  updateData.completedAt = eventTime;
  if (!workOrder.startedAt) return;

  updateData.actualHours =
    (eventTime.getTime() - new Date(workOrder.startedAt).getTime()) /
    (1000 * 60 * 60);
}
