import type { WorkOrderWithRelations } from "../repositories/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";

type MobileWorkOrderMaterialAccessWorkOrder = WorkOrderWithRelations & {
  assignments?: Array<{
    userId: string;
    status: string;
  }>;
};

async function validateMobileAssignedWorkOrderAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
  allowedStatuses: string[];
  invalidStatusMessage: string;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  const { userContext, allowedStatuses, invalidStatusMessage } = params;
  const workOrder = await validateWorkOrderAccess(params);
  if (!workOrder) {
    throw new Error("Work order tidak ditemukan");
  }

  if (
    !isSuperAdminContext(userContext) &&
    (!userContext.tenantId ||
      !workOrder.tenantId ||
      workOrder.tenantId !== userContext.tenantId)
  ) {
    throw new Error("Akses ditolak: Tenant berbeda");
  }

  const isAssignedTo = workOrder.assignedToId === userContext.id;
  const isApprovedPartner = workOrder.assignments?.some(
    (assignment) =>
      assignment.userId === userContext.id && assignment.status === "APPROVED",
  );

  if (!isAssignedTo && !isApprovedPartner) {
    throw new Error(
      "Anda tidak memiliki akses ke work order ini. Hanya lead teknisi dan partner yang disetujui.",
    );
  }

  if (!allowedStatuses.includes(workOrder.status)) {
    throw new Error(invalidStatusMessage);
  }

  return workOrder as MobileWorkOrderMaterialAccessWorkOrder;
}

export async function validateMobileWorkOrderMaterialAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  return validateMobileAssignedWorkOrderAccess({
    ...params,
    allowedStatuses: ["ASSIGNED", "IN_PROGRESS"],
    invalidStatusMessage:
      "Work order harus dalam status ASSIGNED atau IN_PROGRESS",
  });
}

export async function validateMobileWorkOrderMaterialReturnAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  return validateMobileAssignedWorkOrderAccess({
    ...params,
    allowedStatuses: ["ASSIGNED", "IN_PROGRESS", "COMPLETED"],
    invalidStatusMessage:
      "Work order harus dalam status ASSIGNED, IN_PROGRESS, atau COMPLETED untuk mengembalikan barang",
  });
}

export function isSuperAdminContext(
  userContext: Pick<UserContext, "role" | "isSuperAdmin">,
): boolean {
  const { role, isSuperAdmin } = userContext;
  return Boolean(
    isSuperAdmin || role === "SUPER_ADMIN" || role === "Super Admin",
  );
}

export async function validateWorkOrderAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<WorkOrderWithRelations | null> {
  const { repository, workOrderId, userContext } = params;
  const {
    permissions = [],
    departmentId: userDeptId,
    siteId: userSiteId,
  } = userContext;

  const workOrder = await repository.findById(workOrderId);
  if (!workOrder) {
    return null;
  }

  if (isSuperAdminContext(userContext)) {
    return workOrder;
  }

  if (
    permissions.includes("workorders:department_only") &&
    workOrder.departmentId !== userDeptId
  ) {
    throw new Error("Akses ditolak: Departemen berbeda");
  }

  if (
    permissions.includes("workorders:site_only") &&
    workOrder.siteId !== userSiteId
  ) {
    throw new Error("Akses ditolak: Site berbeda");
  }

  return workOrder;
}
