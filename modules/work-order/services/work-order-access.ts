import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";

type MobileWorkOrderMaterialAccessWorkOrder = WorkOrderWithRelations & {
  assignments?: Array<{
    userId: string;
    status: string;
  }>;
};

export async function validateMobileAssignedWorkOrderAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
  allowedStatuses: string[];
  invalidStatusMessage: string;
  /**
   * Melepas akses untuk partner yang undangannya belum disetujui.
   *
   * Hanya untuk jalur baca. Teknisi yang diundang menerima notifikasi undangan
   * tetapi ditolak saat membuka work order-nya, sehingga undangan harus
   * diterima tanpa bisa melihat pekerjaannya lebih dulu. Jalur aksi tidak
   * meneruskan izin ini — mengubah work order tetap menuntut APPROVED.
   */
  allowPendingInvitation?: boolean;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  const {
    userContext,
    allowedStatuses,
    invalidStatusMessage,
    allowPendingInvitation,
  } = params;
  const workOrder = await requireAccessibleWorkOrder(params);

  validateTenantAccess(workOrder, userContext);
  validateAssigneeAccess(workOrder, userContext.id, allowPendingInvitation);
  validateWorkOrderStatus(
    workOrder.status,
    allowedStatuses,
    invalidStatusMessage,
  );

  return workOrder;
}

/** Pastikan work order ada dan lolos validasi akses dasar. */
async function requireAccessibleWorkOrder(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  const workOrder = await validateWorkOrderAccess(params);
  if (!workOrder) throw new Error("Work order tidak ditemukan");
  return workOrder as MobileWorkOrderMaterialAccessWorkOrder;
}

/** Validasi bahwa user berada pada tenant yang sama. */
function validateTenantAccess(
  workOrder: Pick<WorkOrderWithRelations, "tenantId">,
  userContext: UserContext,
): void {
  if (isSuperAdminContext(userContext)) return;
  if (userContext.tenantId && workOrder.tenantId === userContext.tenantId)
    return;
  throw new Error("Akses ditolak: Tenant berbeda");
}

/** Validasi bahwa user adalah lead teknisi atau partner yang disetujui. */
function validateAssigneeAccess(
  workOrder: MobileWorkOrderMaterialAccessWorkOrder,
  userId: string,
  allowPendingInvitation = false,
): void {
  const isUnclaimedStatus =
    workOrder.status === "PENDING" || workOrder.status === "REQUESTED";
  if (isUnclaimedStatus) return;

  const isAssignedTechnician = workOrder.assignedToId === userId;
  // PENDING hanya diterima pada jalur baca. Undangan yang sudah ditolak
  // (REJECTED) tetap tidak pernah melepas akses.
  const statusPartnerDiterima = allowPendingInvitation
    ? ["APPROVED", "PENDING"]
    : ["APPROVED"];
  const isInvitedPartner = workOrder.assignments?.some(
    (assignment) =>
      assignment.userId === userId &&
      statusPartnerDiterima.includes(assignment.status),
  );

  if (isAssignedTechnician || isInvitedPartner) return;
  throw new Error(
    "Anda tidak memiliki akses ke work order ini. Hanya lead teknisi dan partner yang disetujui.",
  );
}

/** Validasi bahwa status work order termasuk status yang diizinkan. */
function validateWorkOrderStatus(
  workOrderStatus: string,
  allowedStatuses: string[],
  invalidStatusMessage: string,
): void {
  if (allowedStatuses.includes(workOrderStatus)) return;
  throw new Error(invalidStatusMessage);
}

/** Validasi akses lintas site/departemen untuk work order umum. */
function validateScopedWorkOrderAccess(
  workOrder: Pick<WorkOrderWithRelations, "departmentId" | "siteId">,
  userContext: UserContext,
): void {
  const {
    permissions = [],
    departmentId: userDeptId,
    siteId: userSiteId,
  } = userContext;

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
  return Boolean(userContext.isSuperAdmin);
}

export async function validateWorkOrderAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<WorkOrderWithRelations | null> {
  const { repository, workOrderId, userContext } = params;
  const workOrder = await repository.findById(workOrderId);
  if (!workOrder) return null;
  if (isSuperAdminContext(userContext)) return workOrder;

  validateScopedWorkOrderAccess(workOrder, userContext);
  return workOrder;
}
