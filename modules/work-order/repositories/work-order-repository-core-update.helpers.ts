import { Prisma } from "@prisma/client";
import type { WorkOrders, WorkOrderStatus } from "@prisma/client";

import type {
  AddUpdateData,
  UpdateWorkOrderData,
  WorkOrderFilters,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
import { buildWorkOrderWhere } from "./work-order-query-builders";
import { buildPaginationArgs } from "./work-order-repository-core-list.helpers";

type PrismaInstance = typeof import("@/lib/prisma").prisma;

export function buildWorkOrderCollectionQuery(input: {
  tenantWhere: Prisma.WorkOrdersWhereInput;
  filters?: WorkOrderFilters;
  page: number;
  limit: number;
}) {
  return {
    where: buildWorkOrderWhere({
      tenantWhere: input.tenantWhere,
      filters: input.filters,
    }),
    paging: buildPaginationArgs(input.page, input.limit),
  };
}

export function buildWorkOrderUpdateRecord(
  data: UpdateWorkOrderData | Record<string, unknown>,
): Prisma.WorkOrdersUncheckedUpdateInput {
  return {
    ...data,
    updatedAt: new Date(),
  } as Prisma.WorkOrdersUncheckedUpdateInput;
}

export function assertWorkOrderWasUpdated(count: number): void {
  if (count > 0) {
    return;
  }

  throw new Error("Work order not found or access denied");
}

export function findUpdatedWorkOrderById(
  prisma: PrismaInstance,
  id: string,
): Promise<WorkOrders> {
  return prisma.workOrders.findUnique({
    where: { id },
  }) as Promise<WorkOrders>;
}

export function buildStatusUpdateData(input: {
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

export function buildWorkOrderStatusUpdate(input: {
  workOrder: WorkOrderWithRelations;
  status: WorkOrderStatus;
  timestamp?: Date;
}) {
  const eventTime = input.timestamp || new Date();

  return {
    status: input.status,
    ...buildStartedAtStatusUpdate(input, eventTime),
    ...buildCompletedStatusUpdate(input, eventTime),
    ...buildVerifiedStatusUpdate(input.status, eventTime),
    ...buildClosedStatusUpdate(input.status, eventTime),
  };
}

function buildStartedAtStatusUpdate(
  input: {
    workOrder: WorkOrderWithRelations;
    status: WorkOrderStatus;
  },
  eventTime: Date,
) {
  if (input.status !== "IN_PROGRESS" || input.workOrder.startedAt) {
    return {};
  }

  return { startedAt: eventTime };
}

function buildCompletedStatusUpdate(
  input: {
    workOrder: WorkOrderWithRelations;
    status: WorkOrderStatus;
  },
  eventTime: Date,
) {
  if (input.status !== "COMPLETED") {
    return {};
  }

  return {
    completedAt: eventTime,
    ...buildActualHoursUpdate(input.workOrder.startedAt, eventTime),
  };
}

function buildActualHoursUpdate(startedAt: Date | null, eventTime: Date) {
  if (!startedAt) {
    return {};
  }

  return {
    actualHours:
      (eventTime.getTime() - new Date(startedAt).getTime()) / (1000 * 60 * 60),
  };
}

function buildVerifiedStatusUpdate(status: WorkOrderStatus, eventTime: Date) {
  if (status !== "VERIFIED") {
    return {};
  }

  return { verifiedAt: eventTime };
}

function buildClosedStatusUpdate(status: WorkOrderStatus, eventTime: Date) {
  if (status !== "CLOSED") {
    return {};
  }

  return { closedAt: eventTime };
}
