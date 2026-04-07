import type { WorkOrderWithRelations } from "../repositories/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";

export function isSuperAdminContext(
  userContext: Pick<UserContext, "role" | "isSuperAdmin">,
): boolean {
  const { role, isSuperAdmin } = userContext;
  return Boolean(isSuperAdmin || role === "SUPER_ADMIN" || role === "Super Admin");
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
