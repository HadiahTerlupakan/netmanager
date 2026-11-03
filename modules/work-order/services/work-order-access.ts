import { isSuperAdmin } from "@/lib/auth/super-admin";
import { siteBolehDiakses } from "@/modules/roles/client";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import type { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import type { UserContext } from "./WorkOrderService";
import { resolveWorkOrderSiteScope } from "./work-order-site-access";
import {
  MOBILE_WORK_ORDER_VIEWER_ACCESS,
  type MobileWorkOrderViewerAccess,
} from "./mobile-work-order-viewer-access";

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

/**
 * Penentu apakah non-peserta boleh MELIHAT work order (tanpa aksi). Hanya
 * jalur baca detail yang mengisinya; jalur aksi tidak pernah meneruskannya.
 */
export type ObserverWorkOrderAccessGuard = (
  workOrder: Pick<WorkOrderWithRelations, "siteId" | "departmentId">,
  userContext: UserContext,
) => Promise<boolean>;

const UNCLAIMED_SCOPE_DENIED_MESSAGE =
  "Akses ditolak: Work order ini berada di luar site/departemen Anda.";
const NON_PARTICIPANT_DENIED_MESSAGE =
  "Anda tidak memiliki akses ke work order ini. Hanya lead teknisi dan partner yang disetujui.";
const UNCLAIMED_WORK_ORDER_STATUSES = ["PENDING", "REQUESTED"];

interface MobileWorkOrderAccessParams {
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
}

/** Work order yang lolos validasi akses beserta hubungan pembacanya. */
export interface MobileWorkOrderViewerAccessResult {
  workOrder: MobileWorkOrderMaterialAccessWorkOrder;
  viewerAccess: MobileWorkOrderViewerAccess;
}

/** Validasi akses mobile: tenant, pemegang/partner (atau kelayakan WO belum diambil), lalu status. */
export async function validateMobileAssignedWorkOrderAccess(
  params: MobileWorkOrderAccessParams,
): Promise<MobileWorkOrderMaterialAccessWorkOrder> {
  // Jalur aksi tidak pernah melepas pengamat, sekalipun pemanggil menyelipkan
  // guard lewat objek yang lebih lebar dari tipe parameternya.
  const { workOrder } = await authorizeMobileWorkOrder({
    ...params,
    observerAccessGuard: undefined,
  });
  return workOrder;
}

/**
 * Jalur baca detail mobile: aturan yang sama dengan
 * `validateMobileAssignedWorkOrderAccess`, ditambah `observerAccessGuard` untuk
 * non-peserta yang boleh melihat WO di panel web. Mengembalikan `viewerAccess`
 * agar aplikasi tahu WO ini hanya boleh dibaca. Jangan dipakai di jalur aksi.
 */
export async function resolveMobileWorkOrderViewerAccess(
  params: MobileWorkOrderAccessParams & {
    observerAccessGuard?: ObserverWorkOrderAccessGuard;
  },
): Promise<MobileWorkOrderViewerAccessResult> {
  return authorizeMobileWorkOrder(params);
}

/** Inti validasi akses mobile; `observerAccessGuard` hanya dari jalur baca. */
async function authorizeMobileWorkOrder(
  params: MobileWorkOrderAccessParams & {
    observerAccessGuard?: ObserverWorkOrderAccessGuard;
  },
): Promise<MobileWorkOrderViewerAccessResult> {
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
  const viewerAccess = isParticipant
    ? MOBILE_WORK_ORDER_VIEWER_ACCESS.PARTICIPANT
    : await resolveNonParticipantAccess(workOrder, userContext, params);
  validateWorkOrderStatus(
    workOrder.status,
    allowedStatuses,
    invalidStatusMessage,
  );

  return { workOrder, viewerAccess };
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
 * Non-peserta hanya boleh mengklaim WO yang belum diambil, dan itu pun hanya
 * bila lolos aturan daftar WO tersedia (super admin dilepas). Selain itu,
 * jalur baca boleh melepas non-peserta sebagai pengamat lewat
 * `observerAccessGuard`; tanpa guard itu non-peserta ditolak seperti dulu.
 */
async function resolveNonParticipantAccess(
  workOrder: MobileWorkOrderMaterialAccessWorkOrder,
  userContext: UserContext,
  guards: {
    unclaimedAccessGuard?: UnclaimedWorkOrderAccessGuard;
    observerAccessGuard?: ObserverWorkOrderAccessGuard;
  },
): Promise<MobileWorkOrderViewerAccess> {
  const isUnclaimedStatus = UNCLAIMED_WORK_ORDER_STATUSES.includes(
    workOrder.status,
  );
  if (
    isUnclaimedStatus &&
    (await canClaimUnclaimedWorkOrder(
      workOrder,
      userContext,
      guards.unclaimedAccessGuard,
    ))
  ) {
    return MOBILE_WORK_ORDER_VIEWER_ACCESS.CLAIMABLE;
  }

  const isObserver = guards.observerAccessGuard
    ? await guards.observerAccessGuard(workOrder, userContext)
    : false;
  if (isObserver) return MOBILE_WORK_ORDER_VIEWER_ACCESS.OBSERVER;

  throw new Error(
    isUnclaimedStatus
      ? UNCLAIMED_SCOPE_DENIED_MESSAGE
      : NON_PARTICIPANT_DENIED_MESSAGE,
  );
}

/** Kelayakan klaim WO belum diambil; tanpa guard selalu ditolak (fail closed). */
async function canClaimUnclaimedWorkOrder(
  workOrder: MobileWorkOrderMaterialAccessWorkOrder,
  userContext: UserContext,
  unclaimedAccessGuard?: UnclaimedWorkOrderAccessGuard,
): Promise<boolean> {
  if (isSuperAdminContext(userContext)) return true;
  if (!unclaimedAccessGuard) return false;
  return unclaimedAccessGuard(workOrder, userContext);
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
 * bila work order berada dalam lingkup pengguna. Lingkup site mencakup SELURUH
 * site pengguna (`siteIds`, jatuh ke `siteId` legacy). Pengguna terbatas tanpa
 * site/departemen tidak cocok dengan work order mana pun (fail closed).
 * Super admin tidak dilepas di sini; pemanggil yang memutuskan.
 */
export function getWorkOrderScopeViolation(
  workOrder: Pick<WorkOrderWithRelations, "departmentId" | "siteId">,
  userContext: Pick<
    UserContext,
    "permissions" | "departmentId" | "siteId" | "siteIds"
  >,
): string | null {
  const { permissions = [], departmentId: userDeptId } = userContext;

  if (
    permissions.includes("workorders:department_only") &&
    (!userDeptId || workOrder.departmentId !== userDeptId)
  ) {
    return "Akses ditolak: Departemen berbeda";
  }

  const lingkupSite = resolveWorkOrderSiteScope({
    permissions,
    owner: userContext,
    isSuperAdmin: false,
  });
  if (!siteBolehDiakses(lingkupSite, workOrder.siteId)) {
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

/**
 * Super admin menurut flag `isSuperAdmin` saja. Dipakai pemeriksaan tenant
 * dan WO yang belum diambil, yang sengaja tidak mempercayai nama role.
 */
export function isSuperAdminContext(
  userContext: Pick<UserContext, "role" | "isSuperAdmin">,
): boolean {
  return Boolean(userContext.isSuperAdmin);
}

/**
 * Ambil WO lalu tegakkan lingkup site/departemen. Super admin dilepas menurut
 * `isSuperAdmin()` (flag ATAU nama role "SUPER_ADMIN"/"Super Admin"); dulu
 * hanya flag yang dibaca, sehingga super admin yang dikenali lewat nama role
 * ditolak oleh toggle `workorders:*_only` milik role-nya.
 */
export async function validateWorkOrderAccess(params: {
  repository: Pick<WorkOrderRepository, "findById">;
  workOrderId: string;
  userContext: UserContext;
}): Promise<WorkOrderWithRelations | null> {
  const { repository, workOrderId, userContext } = params;
  const workOrder = await repository.findById(workOrderId);
  if (!workOrder) return null;
  if (isSuperAdmin(userContext)) return workOrder;

  validateScopedWorkOrderAccess(workOrder, userContext);
  return workOrder;
}
