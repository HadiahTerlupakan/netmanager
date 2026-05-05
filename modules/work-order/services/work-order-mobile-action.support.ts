import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";
import type { MobileUserContext } from "./work-order-mobile-action.types";
import { validateMobileAssignedWorkOrderAccess } from "./work-order-access";

export async function ensureMobileWorkOrderAccess(input: {
  repository: WorkOrderRepository;
  workOrderId: string;
  actor: MobileUserContext;
  allowedStatuses: string[];
  invalidStatusMessage: string;
}) {
  await validateMobileAssignedWorkOrderAccess({
    repository: input.repository,
    workOrderId: input.workOrderId,
    userContext: buildMobileActionUserContext(input.actor),
    allowedStatuses: input.allowedStatuses,
    invalidStatusMessage: input.invalidStatusMessage,
  });
}

function buildMobileActionUserContext(actor: MobileUserContext): UserContext {
  return {
    id: actor.id,
    name: actor.name,
    role: actor.role,
    permissions: [] as string[],
    siteId: actor.siteId,
    tenantId: actor.tenantId,
    isSuperAdmin: Boolean(actor.isSuperAdmin),
  };
}

export async function getWorkOrderOrThrow(
  repository: Pick<WorkOrderRepository, "findById">,
  workOrderId: string,
) {
  const workOrder = await repository.findById(workOrderId);
  if (!workOrder) {
    throw new Error("WORK_ORDER_NOT_FOUND");
  }
  return workOrder;
}

export async function addOptionalNote(input: {
  repository: Pick<WorkOrderRepository, "addUpdate">;
  workOrderId: string;
  notes?: string;
  userIdForDb?: string;
}) {
  if (!input.notes) {
    return;
  }

  await input.repository.addUpdate({
    workOrderId: input.workOrderId,
    updateType: "NOTE",
    message: input.notes,
    createdById: input.userIdForDb,
  });
}

export async function addPauseNote(input: {
  repository: Pick<WorkOrderRepository, "addUpdate">;
  workOrderId: string;
  notes?: string;
  userIdForDb?: string;
}) {
  if (!input.notes) {
    return;
  }

  await input.repository.addUpdate({
    workOrderId: input.workOrderId,
    updateType: "NOTE",
    message: `Work Order Paused: ${input.notes}`,
    createdById: input.userIdForDb,
  });
}

export function getAllowedActionStatuses(action: string) {
  if (action === "CLAIM") {
    return {
      statuses: ["PENDING"],
      invalidStatusMessage: "Hanya WO berstatus PENDING yang dapat diklaim",
    };
  }

  return {
    statuses: ["ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED"],
    invalidStatusMessage: "Work order tidak dapat diubah pada status ini",
  };
}
