import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";

type WorkOrderAccessRepository = Pick<WorkOrderRepository, "findById">;

export async function validateWorkOrderAccess(params: {
  repository: WorkOrderAccessRepository;
  workOrderId: string;
  userContext: UserContext;
}): Promise<void> {
  const { repository, workOrderId, userContext } = params;
  const {
    role,
    permissions = [],
    departmentId: userDeptId,
    siteId: userSiteId,
    isSuperAdmin: userIsSuperAdmin,
  } = userContext;

  const isSuperAdmin =
    userIsSuperAdmin || role === "SUPER_ADMIN" || role === "Super Admin";
  if (isSuperAdmin) return;

  const workOrder = await repository.findById(workOrderId);
  if (!workOrder) {
    throw new Error("Work order tidak ditemukan");
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
}
