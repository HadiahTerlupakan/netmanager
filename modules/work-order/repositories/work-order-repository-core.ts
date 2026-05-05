import { Prisma } from "@prisma/client";
import type { WorkOrders, WorkOrderStatus } from "@prisma/client";

import { validateStatusTransition } from "../utils/status-transitions";
import type {
  AddUpdateData,
  UpdateWorkOrderData,
  WorkOrderFilters,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
import {
  buildPagedWorkOrderResult,
  buildStaleReminderSelect,
  buildStaleReminderWhere,
  buildWorkOrderListInclude,
  buildWorkOrderListResult,
  buildWorkOrderSummarySelect,
} from "./work-order-repository-core-list.helpers";
import {
  assertWorkOrderWasUpdated,
  buildStatusUpdateData,
  buildWorkOrderCollectionQuery,
  buildWorkOrderStatusUpdate,
  buildWorkOrderUpdateRecord,
  findUpdatedWorkOrderById,
} from "./work-order-repository-core-update.helpers";
import {
  WORK_ORDER_CUSTOMER_SELECT,
  WORK_ORDER_DEPARTMENT_SELECT,
  WORK_ORDER_DETAIL_INCLUDE,
  WORK_ORDER_ASSIGNEE_SELECT,
  WORK_ORDER_ASSIGNMENTS_INCLUDE,
  WORK_ORDER_UPDATES_INCLUDE,
  WORK_ORDER_LIST_SELECT,
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
  const query = buildWorkOrderCollectionQuery(input);
  const [workOrders, total] = await Promise.all([
    findPaginatedWorkOrders(input.prisma, query.where, query.paging),
    input.prisma.workOrders.count({ where: query.where }),
  ]);

  return buildPagedWorkOrderResult({
    workOrders,
    total,
    page: input.page,
    limit: input.limit,
  });
}

export async function findAllWorkOrdersForList(input: {
  prisma: PrismaInstance;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  filters?: WorkOrderFilters;
  page: number;
  limit: number;
}) {
  const query = buildWorkOrderCollectionQuery(input);
  const result = await findWorkOrderListCollection(input.prisma, query);

  return buildWorkOrderListResult({
    workOrders: result.workOrders,
    total: result.total,
    page: input.page,
    limit: input.limit,
    summaryRows: result.summaryRows,
  });
}

async function findWorkOrderListCollection(
  prisma: PrismaInstance,
  query: ReturnType<typeof buildWorkOrderCollectionQuery>,
) {
  const [workOrders, total, summaryRows] = await Promise.all([
    findWorkOrderListRows(prisma, query.where, query.paging),
    prisma.workOrders.count({ where: query.where }),
    findWorkOrderSummaryRows(prisma, query.where),
  ]);

  return { workOrders, total, summaryRows };
}

export async function findStaleReminderWorkOrders(input: {
  prisma: PrismaInstance;
  tenantWhere: Prisma.WorkOrdersWhereInput;
  now: Date;
}) {
  return input.prisma.workOrders.findMany({
    where: buildStaleReminderWhere({
      tenantWhere: input.tenantWhere,
      now: input.now,
      staleWorkOrderAgeMs: STALE_WORK_ORDER_AGE_MS,
    }),
    select: buildStaleReminderSelect(),
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
    data: buildWorkOrderUpdateRecord(input.data),
  });

  assertWorkOrderWasUpdated(result.count);
  return findUpdatedWorkOrderById(input.prisma, input.id);
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
  return input.update(input.workOrder.id, buildWorkOrderStatusUpdate(input));
}

async function findPaginatedWorkOrders(
  prisma: PrismaInstance,
  where: Prisma.WorkOrdersWhereInput,
  paging: { skip: number; take: number },
) {
  return prisma.workOrders.findMany({
    where,
    include: buildWorkOrderListInclude(),
    orderBy: { createdAt: "desc" },
    ...paging,
  });
}

async function findWorkOrderListRows(
  prisma: PrismaInstance,
  where: Prisma.WorkOrdersWhereInput,
  paging: { skip: number; take: number },
) {
  return prisma.workOrders.findMany({
    where,
    select: WORK_ORDER_LIST_SELECT,
    orderBy: { createdAt: "desc" },
    ...paging,
  });
}

async function findWorkOrderSummaryRows(
  prisma: PrismaInstance,
  where: Prisma.WorkOrdersWhereInput,
) {
  return prisma.workOrders.findMany({
    where,
    select: buildWorkOrderSummarySelect(),
  });
}
