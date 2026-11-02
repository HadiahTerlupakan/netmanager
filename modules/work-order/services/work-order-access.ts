import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";

type MobileWorkOrderMaterialAccessWorkOrder = WorkOrderWithRelations & {
  assignments?: Array<{
    userId: string;
    /** Terisi bila penerima tugas adalah mitra eksternal, bukan karyawan. */
    mitraId?: string | null;
    status: string;
  }>;
};

/**
 * Penentu kelayakan aktor atas work order yang belum diambil (PENDING/REQUESTED).
 * Diisi dengan aturan daftar WO tersedia oleh pemanggil jalur detail/klaim.
 */
export type UnclaimedWorkOrderAccessGuard = (
  workOrder: Pick<WorkOrderWithRelations, "siteId" | "departmentId">,
  userContext: UserContext,
) => Promise<boolean>;

const UNCLAIMED_SCOPE_DENIED_MESSAGE =
  "Akses ditolak: Work order ini berada di luar site/departemen Anda.";

/** Validasi akses mobile: tenant, pemegang/partner (atau kelayakan WO belum diambil), lalu status. */
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
  /**
   * Kelayakan untuk WO yang belum diambil oleh aktor yang bukan pemegang atau
   * partner. Tanpa guard, WO semacam itu ditolak (fail closed) — dulu status
   * PENDING/REQUESTED melewati semua pemeriksaan sehingga WO site lain bisa
   * dibuka dan diklaim lewat endpoint mobile.
   */
  unclaimedAccessGuard?: UnclaimedWorkOrderAccessGuard;
}): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  const {
    userContext,
    allowedStatuses,
    invalidStatusMessage,
    allowPendingInvitation,
  } = params;
  const workOrder = await requireAccessibleWorkOrder(params);

  validateTenantAccess(workOrder, userContext);
  const isParticipant = isWorkOrderParticipant(
    workOrder,
    userContext.id,
    allowPendingInvitation,
  );
  if (!isParticipant) {
    await validateNonParticipantAccess(
      workOrder,
      userContext,
      params.unclaimedAccessGuard,
    );
  }
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

/**
 * Apakah pelaku adalah pemegang work order atau partner yang disetujui.
 *
 * Mitra eksternal tercatat di kolomnya sendiri (`assignedMitraId`,
 * `assignments.mitraId`) karena id-nya berasal dari database mitra, bukan
 * `User`. Tanpa ikut diperiksa, mitra teknisi berhasil mengambil work order
 * lewat `claimAvailableWorkOrder` lalu ditolak saat membukanya sendiri.
 */
function isWorkOrderParticipant(
  workOrder: MobileWorkOrderMaterialAccessWorkOrder,
  userId: string,
  allowPendingInvitation = false,
): boolean {
  const isAssignedTechnician = workOrder.assignedToId === userId;
  const isAssignedMitra = workOrder.assignedMitraId === userId;
  // PENDING hanya diterima pada jalur baca. Undangan yang sudah ditolak
  // (REJECTED) tetap tidak pernah melepas akses.
  const statusPartnerDiterima = allowPendingInvitation
    ? ["APPROVED", "PENDING"]
    : ["APPROVED"];
  const isInvitedPartner = workOrder.assignments?.some(
    (assignment) =>
      (assignment.userId === userId || assignment.mitraId === userId) &&
      statusPartnerDiterima.includes(assignment.status),
  );

  return Boolean(isAssignedTechnician || isAssignedMitra || isInvitedPartner);
}

/**
 * Non-peserta hanya boleh menyentuh WO yang belum diambil, dan itu pun hanya
 * bila lolos aturan daftar WO tersedia. Super admin dilepas.
 */
async function validateNonParticipantAccess(
  workOrder: MobileWorkOrderMaterialAccessWorkOrder,
  userContext: UserContext,
  unclaimedAccessGuard?: UnclaimedWorkOrderAccessGuard,
): Promise<void> {
  const isUnclaimedStatus =
    workOrder.status === "PENDING" || workOrder.status === "REQUESTED";
  if (!isUnclaimedStatus) {
    throw new Error(
      "Anda tidak memiliki akses ke work order ini. Hanya lead teknisi dan partner yang disetujui.",
    );
  }

  if (isSuperAdminContext(userContext)) return;
  const isEligible = unclaimedAccessGuard
    ? await unclaimedAccessGuard(workOrder, userContext)
    : false;
  if (!isEligible) throw new Error(UNCLAIMED_SCOPE_DENIED_MESSAGE);
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

/**
 * Pesan pelanggaran lingkup `workorders:department_only|site_only`, atau `null`
 * bila work order berada dalam lingkup pengguna. Pengguna terbatas tanpa
 * site/departemen tidak cocok dengan work order mana pun (fail closed).
 */
export function getWorkOrderScopeViolation(
  workOrder: Pick<WorkOrderWithRelations, "departmentId" | "siteId">,
  userContext: Pick<UserContext, "permissions" | "departmentId" | "siteId">,
): string | null {
  const {
    permissions = [],
    departmentId: userDeptId,
    siteId: userSiteId,
  } = userContext;

  if (
    permissions.includes("workorders:department_only") &&
    (!userDeptId || workOrder.departmentId !== userDeptId)
  ) {
    return "Akses ditolak: Departemen berbeda";
  }

  if (
    permissions.includes("workorders:site_only") &&
    (!userSiteId || workOrder.siteId !== userSiteId)
  ) {
    return "Akses ditolak: Site berbeda";
  }

  return null;
}

/** Validasi akses lintas site/departemen untuk work order umum. */
function validateScopedWorkOrderAccess(
  workOrder: Pick<WorkOrderWithRelations, "departmentId" | "siteId">,
  userContext: UserContext,
): void {
  const violation = getWorkOrderScopeViolation(workOrder, userContext);
  if (violation) throw new Error(violation);
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
