import type { WorkOrders } from "@prisma/client";

import type {
  AddUpdateData,
  CreateWorkOrderData,
  WorkOrderWithRelations,
} from "./IWorkOrderRepository";
import {
  approveRequestedWorkOrder,
  findRequestedWorkOrders,
  rejectRequestedWorkOrder,
} from "./work-order-repository-requests";

type PrismaInstance = typeof import("@/lib/prisma").prisma;

export async function createWorkOrderRequest(input: {
  prisma: PrismaInstance;
  data: CreateWorkOrderData & { requestedById: string };
}) {
  const { createWorkOrderRequestRecord } =
    await import("./work-order-repository-create");
  return createWorkOrderRequestRecord(
    input.prisma,
    input.data,
  ) as Promise<WorkOrders>;
}

export async function approveWorkOrderRequest(input: {
  prisma: PrismaInstance;
  id: string;
  approvedById: string;
  workOrder: WorkOrderWithRelations | null;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
}) {
  validateRequestStatus(input.workOrder, "approve");
  const result = await approveRequestedWorkOrder(
    input.prisma,
    input.id,
    input.approvedById,
  );
  await input.addUpdate({
    workOrderId: input.id,
    updateType: "STATUS_CHANGE",
    message: "WO Request disetujui oleh Admin",
    oldStatus: "REQUESTED",
    newStatus: "PENDING",
    createdById: input.approvedById,
  });
  return result;
}

export async function rejectWorkOrderRequest(input: {
  prisma: PrismaInstance;
  id: string;
  rejectedById: string;
  reason: string;
  workOrder: WorkOrderWithRelations | null;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
}) {
  validateRequestStatus(input.workOrder, "reject");
  const result = await rejectRequestedWorkOrder(
    input.prisma,
    input.id,
    input.rejectedById,
    input.reason,
  );
  await input.addUpdate({
    workOrderId: input.id,
    updateType: "STATUS_CHANGE",
    message: `WO Request ditolak: ${input.reason}`,
    oldStatus: "REQUESTED",
    newStatus: "CANCELLED",
    createdById: input.rejectedById,
  });
  return result;
}

export function findAllWorkOrderRequests(input: {
  prisma: PrismaInstance;
  filters?: { departmentId?: string; siteId?: string; search?: string };
  page: number;
  limit: number;
}) {
  return findRequestedWorkOrders(
    input.prisma,
    input.filters,
    input.page,
    input.limit,
  );
}

function validateRequestStatus(
  workOrder: WorkOrderWithRelations | null,
  action: "approve" | "reject",
) {
  if (!workOrder) throw new Error("Work order not found");
  if (workOrder.status === "REQUESTED") return;

  throw new Error(
    `Cannot ${action}: Work order status is ${workOrder.status}, expected REQUESTED`,
  );
}
