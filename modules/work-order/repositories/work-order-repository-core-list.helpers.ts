import { Prisma } from "@prisma/client";

import type { WorkOrderListItem } from "../domain/ports/IWorkOrderRepository";
import {
  buildWorkOrderListSummary,
  type WorkOrderListSummarySource,
} from "../utils/work-order-list-summary";
import {
  WORK_ORDER_ASSIGNMENTS_INCLUDE,
  WORK_ORDER_DEPARTMENT_SELECT,
  WORK_ORDER_LIST_SUMMARY_SELECT,
  WORK_ORDER_UPDATES_INCLUDE,
} from "./work-order-repository-selects";

export function buildPaginationArgs(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

export function buildPagedWorkOrderResult<T>(input: {
  workOrders: T[];
  total: number;
  page: number;
  limit: number;
}) {
  return {
    workOrders: input.workOrders,
    total: input.total,
    page: input.page,
    totalPages: Math.ceil(input.total / input.limit),
  };
}

export function buildWorkOrderListResult(input: {
  workOrders: WorkOrderListItem[];
  total: number;
  page: number;
  limit: number;
  summaryRows: WorkOrderListSummarySource[];
}) {
  return {
    workOrders: input.workOrders,
    total: input.total,
    page: input.page,
    totalPages: Math.ceil(input.total / input.limit),
    summary: buildWorkOrderListSummary(input.summaryRows),
  };
}

export function buildStaleReminderWhere(input: {
  tenantWhere: Prisma.WorkOrdersWhereInput;
  now: Date;
  staleWorkOrderAgeMs: number;
}): Prisma.WorkOrdersWhereInput {
  return {
    ...input.tenantWhere,
    status: { in: ["PENDING", "ASSIGNED", "IN_PROGRESS"] },
    createdAt: {
      lte: new Date(input.now.getTime() - input.staleWorkOrderAgeMs),
    },
  };
}

export function buildStaleReminderSelect() {
  return {
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
  };
}

export function buildWorkOrderListInclude() {
  return {
    pelanggan: { select: buildWorkOrderCustomerSelect() },
    site: { select: buildWorkOrderSiteSelect() },
    department: { select: WORK_ORDER_DEPARTMENT_SELECT },
    assignedTo: { select: buildWorkOrderAssigneeSelect() },
    tasks: true,
    assignments: WORK_ORDER_ASSIGNMENTS_INCLUDE,
    updates: WORK_ORDER_UPDATES_INCLUDE,
    attachments: true,
  };
}

function buildWorkOrderCustomerSelect() {
  return {
    id: true,
    idPelanggan: true,
    nama: true,
    email: true,
    noTelp: true,
  };
}

function buildWorkOrderSiteSelect() {
  return { id: true, name: true, code: true };
}

function buildWorkOrderAssigneeSelect() {
  return {
    id: true,
    name: true,
    email: true,
    role: { select: { isTechnical: true } },
  };
}

export function buildWorkOrderSummarySelect() {
  return WORK_ORDER_LIST_SUMMARY_SELECT;
}
