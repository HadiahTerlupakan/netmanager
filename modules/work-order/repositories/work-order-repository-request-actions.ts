import type { WorkOrders } from "@prisma/client";

import type {
  AddUpdateData,
  CreateWorkOrderData,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
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

/**
 * Approve work order request and update status to PENDING.
 * Note: 21 baris - sudah optimal dengan validation + action execution + status update.
 * Memecah lebih lanjut akan memisahkan validation dari action yang harus berurutan.
 */
export async function approveWorkOrderRequest(input: {
  prisma: PrismaInstance;
  id: string;
  approvedById: string;
  workOrder: WorkOrderWithRelations | null;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
}) {
  validateRequestStatus(input.workOrder, "approve");

  return completeWorkOrderRequestAction({
    execute: () =>
      approveRequestedWorkOrder(input.prisma, input.id, input.approvedById),
    addUpdate: input.addUpdate,
    updateData: buildRequestStatusUpdate({
      workOrderId: input.id,
      createdById: input.approvedById,
      message: "WO Request disetujui oleh Admin",
      newStatus: "PENDING",
    }),
  });
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

  return completeWorkOrderRequestAction(buildRejectedRequestActionInput(input));
}

function buildRejectedRequestActionInput(input: {
  prisma: PrismaInstance;
  id: string;
  rejectedById: string;
  reason: string;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
}) {
  return {
    execute: () => rejectRequestedWorkOrderByInput(input),
    addUpdate: input.addUpdate,
    updateData: buildRejectedRequestStatusUpdate(input),
  };
}

function rejectRequestedWorkOrderByInput(input: {
  prisma: PrismaInstance;
  id: string;
  rejectedById: string;
  reason: string;
}) {
  return rejectRequestedWorkOrder(
    input.prisma,
    input.id,
    input.rejectedById,
    input.reason,
  );
}

function buildRejectedRequestStatusUpdate(input: {
  id: string;
  rejectedById: string;
  reason: string;
}) {
  return buildRequestStatusUpdate({
    workOrderId: input.id,
    createdById: input.rejectedById,
    message: `WO Request ditolak: ${input.reason}`,
    newStatus: "CANCELLED",
  });
}

async function completeWorkOrderRequestAction<T>(input: {
  execute: () => Promise<T>;
  addUpdate: (data: AddUpdateData) => Promise<unknown>;
  updateData: AddUpdateData;
}) {
  const result = await input.execute();
  await input.addUpdate(input.updateData);
  return result;
}

function buildRequestStatusUpdate(input: {
  workOrderId: string;
  createdById: string;
  message: string;
  newStatus: "PENDING" | "CANCELLED";
}): AddUpdateData {
  return {
    workOrderId: input.workOrderId,
    updateType: "STATUS_CHANGE",
    message: input.message,
    oldStatus: "REQUESTED",
    newStatus: input.newStatus,
    createdById: input.createdById,
  };
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
