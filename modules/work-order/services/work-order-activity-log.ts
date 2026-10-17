import { logActivitySafe } from "@/lib/logger";

import type { WorkOrderStatus } from "../types/work-order.enums";

/** Nama aksi Log Aktivitas untuk setiap tindakan work order. */
export const WORK_ORDER_ACTIVITY_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  ASSIGN: "ASSIGN",
  STATUS_CHANGE: "STATUS_CHANGE",
  VERIFY: "VERIFY",
  REJECT_RESULT: "REJECT_RESULT",
  CANCEL: "CANCEL",
  DELETE: "DELETE",
  SEND_REMINDER: "SEND_REMINDER",
  APPROVE_REQUEST: "APPROVE_REQUEST",
  REJECT_REQUEST: "REJECT_REQUEST",
  EXPORT_PDF: "EXPORT_PDF",
} as const;

export type WorkOrderActivityAction =
  (typeof WORK_ORDER_ACTIVITY_ACTIONS)[keyof typeof WORK_ORDER_ACTIVITY_ACTIONS];

/** Identitas WO yang ditulis ke setiap entri log. */
export interface WorkOrderActivityTarget {
  id: string;
  workOrderNumber: string;
  title?: string | null;
  tenantId?: string | null;
}

const WORK_ORDER_SUBJECT = "Work Order";
const WORK_ORDER_LIST_SUBJECT = `${WORK_ORDER_SUBJECT} Daftar`;

/**
 * Catat satu tindakan work order ke Log Aktivitas. Subjek memuat nomor WO
 * supaya tabel log terbaca dan bisa dicari per WO.
 */
export function recordWorkOrderActivity(input: {
  action: WorkOrderActivityAction;
  workOrder: WorkOrderActivityTarget;
  actorId: string;
  details?: Record<string, unknown>;
}): void {
  const { workOrder } = input;
  logActivitySafe({
    action: input.action,
    subject: `${WORK_ORDER_SUBJECT} ${workOrder.workOrderNumber}`,
    userId: input.actorId,
    tenantId: workOrder.tenantId ?? undefined,
    details: {
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      ...(workOrder.title ? { title: workOrder.title } : {}),
      ...input.details,
    },
  });
}

/**
 * Tentukan nama aksi log dari transisi status: verifikasi, tolak hasil, dan
 * batal punya nama sendiri; selain itu tercatat sebagai perubahan status.
 */
export function describeWorkOrderStatusActivity(input: {
  previousStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  note?: string;
}): { action: WorkOrderActivityAction; details: Record<string, unknown> } {
  const transition = { from: input.previousStatus, to: input.status };
  const reason = input.note ? { reason: input.note } : {};

  if (input.status === "VERIFIED") {
    return { action: WORK_ORDER_ACTIVITY_ACTIONS.VERIFY, details: transition };
  }
  if (input.status === "CANCELLED") {
    return {
      action: WORK_ORDER_ACTIVITY_ACTIONS.CANCEL,
      details: { ...transition, ...reason },
    };
  }
  if (input.previousStatus === "COMPLETED" && input.status === "IN_PROGRESS") {
    return {
      action: WORK_ORDER_ACTIVITY_ACTIONS.REJECT_RESULT,
      details: { ...transition, ...reason },
    };
  }
  return {
    action: WORK_ORDER_ACTIVITY_ACTIONS.STATUS_CHANGE,
    details: { ...transition, ...(input.note ? { note: input.note } : {}) },
  };
}

/** Catat unduhan daftar work order (PDF dibuat di browser). */
export function recordWorkOrderExport(input: {
  format: "PDF";
  actorId: string;
  tenantId?: string;
  exportedCount: number;
  total: number;
  filters: string[];
}): void {
  logActivitySafe({
    action: WORK_ORDER_ACTIVITY_ACTIONS.EXPORT_PDF,
    subject: WORK_ORDER_LIST_SUBJECT,
    userId: input.actorId,
    tenantId: input.tenantId,
    details: {
      format: input.format,
      exportedCount: input.exportedCount,
      total: input.total,
      filters: input.filters,
    },
  });
}
