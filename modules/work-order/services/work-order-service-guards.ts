import type { WorkOrderStatus } from "../types/work-order.enums";
import type {
  ServiceResult,
  UpdateWorkOrderInput,
} from "./work-order-service.contracts";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import { createWorkOrderNotFoundResult } from "./work-order-service-helpers";

/** Pastikan work order tersedia sebelum operasi dilanjutkan. */
export function ensureWorkOrderExists(
  workOrder: WorkOrderWithRelations | null,
): ServiceResult<never> | null {
  if (workOrder) {
    return null;
  }
  return createWorkOrderNotFoundResult();
}

/** Pastikan status request work order masih REQUESTED. */
export function ensureRequestedStatus(
  status: WorkOrderStatus,
  action: "disetujui" | "ditolak",
): ServiceResult<never> | null {
  if (status === "REQUESTED") {
    return null;
  }
  return {
    success: false,
    error: `Hanya work order dengan status REQUESTED yang dapat ${action}`,
    code: "INVALID_STATUS",
  };
}

/** Pastikan alasan penolakan tersedia sebelum request ditolak. */
export function ensureRejectionReason(
  reason: string,
): ServiceResult<never> | null {
  if (reason) {
    return null;
  }
  return {
    success: false,
    error: "Alasan penolakan wajib diisi",
    code: "VALIDATION_ERROR",
  };
}

/** Bentuk payload update work order yang aman untuk repository. */
export function buildWorkOrderUpdatePayload(
  input: UpdateWorkOrderInput,
): Record<string, unknown> {
  const { scheduledDate: rawScheduledDate, ...restInput } = input;
  return {
    ...restInput,
    ...(rawScheduledDate && { scheduledDate: new Date(rawScheduledDate) }),
  };
}
