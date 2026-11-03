import type { WorkOrderStatus } from "../types/work-order.enums";
import type { WorkOrderWithRelations } from "../domain/ports/IWorkOrderRepository";
import { WorkOrderRepository } from "../repositories/WorkOrderRepository";
import { resolveMobileWorkOrderViewerAccess } from "./work-order-access";
import { mobileUnclaimedWorkOrderGuard } from "./mobile-unclaimed-work-order-guard";
import {
  createMobileObserverWorkOrderGuard,
  type ObserverScopeContextLoader,
} from "./mobile-work-order-observer-guard";
import type { MobileWorkOrderViewerAccess } from "./mobile-work-order-viewer-access";
import { getAdminWorkOrderRouteService } from "./AdminWorkOrderRouteService";

const ACTIVE_WORK_ORDER_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "PENDING",
  "ON_HOLD",
] as const;
const HISTORY_WORK_ORDER_STATUSES = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;
const MOBILE_DETAIL_STATUSES = [
  "REQUESTED",
  "PENDING",
  "ASSIGNED",
  "IN_PROGRESS",
  "ON_HOLD",
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
  "CANCELLED",
] as const;

interface MobileWorkOrderUserContext {
  id: string;
  name?: string;
  role?: string;
  siteId?: string;
  tenantId?: string;
  isSuperAdmin: boolean;
  /**
   * Permission role ASLI pembaca. Hanya dipakai untuk menilai akses pengamat
   * (`OBSERVER`); tidak pernah masuk ke validasi peserta.
   */
  permissions?: readonly string[];
}

/** Profil lingkup dari jalur web (`getUserContext`): site via `userSites` & departemen. */
const loadWebScopeContext: ObserverScopeContextLoader = (user, permissions) =>
  getAdminWorkOrderRouteService().getUserContext(user, permissions);

export class EmployeeWorkOrderQueryService {
  private readonly repository: WorkOrderRepository;
  private readonly loadObserverScopeContext: ObserverScopeContextLoader;

  constructor(
    repository?: WorkOrderRepository,
    loadObserverScopeContext: ObserverScopeContextLoader = loadWebScopeContext,
  ) {
    this.repository = repository ?? new WorkOrderRepository();
    this.loadObserverScopeContext = loadObserverScopeContext;
  }

  /** Mengambil daftar work order yang ditugaskan ke user. */
  async getAssignedWorkOrders(userId: string) {
    return this.repository.findAllForList({ assignedToId: userId });
  }

  /** Mengambil daftar work order mobile berdasarkan tipe tab. */
  async getMobileWorkOrders(
    userId: string,
    type: string,
    page: number,
    limit: number,
  ) {
    const status = this.resolveMobileStatuses(type);
    return this.repository.findAllForList(
      { involvedUserId: userId, status },
      page,
      limit,
    );
  }

  /**
   * Mengambil detail work order mobile dengan validasi akses, beserta
   * `viewerAccess`. Non-peserta yang boleh melihat WO di panel web mendapat
   * `OBSERVER` (hanya baca); jalur aksi tetap menolaknya.
   */
  async getMobileWorkOrderDetail(
    workOrderId: string,
    userContext: MobileWorkOrderUserContext,
  ): Promise<MobileWorkOrderDetail> {
    const { workOrder, viewerAccess } =
      await resolveMobileWorkOrderViewerAccess({
        repository: this.repository,
        workOrderId,
        userContext: this.buildAccessContext(userContext),
        allowedStatuses: [...MOBILE_DETAIL_STATUSES],
        invalidStatusMessage: "Work order tidak dapat diakses pada status ini",
        // Jalur baca: partner yang diundang perlu melihat pekerjaannya sebelum
        // memutuskan menerima atau menolak. Jalur aksi tetap menuntut APPROVED.
        allowPendingInvitation: true,
        unclaimedAccessGuard: mobileUnclaimedWorkOrderGuard,
        observerAccessGuard: createMobileObserverWorkOrderGuard({
          permissions: userContext.permissions ?? [],
          loadScopeContext: this.loadObserverScopeContext,
        }),
      });
    return { ...workOrder, viewerAccess };
  }

  /**
   * Membangun konteks akses mobile yang konsisten.
   *
   * `permissions` sengaja kosong: toggle `workorders:*_only` milik panel web
   * tidak boleh mencabut akses pemegang/partner atas WO-nya sendiri. Lingkup
   * site/departemen untuk WO yang belum diambil ditegakkan lewat
   * `unclaimedAccessGuard`.
   */
  private buildAccessContext(userContext: MobileWorkOrderUserContext) {
    return {
      id: userContext.id,
      name: userContext.name,
      role: userContext.role,
      permissions: [] as string[],
      siteId: userContext.siteId,
      tenantId: userContext.tenantId,
      isSuperAdmin: userContext.isSuperAdmin,
    };
  }

  /** Menentukan status filter mobile berdasarkan tipe tab. */
  private resolveMobileStatuses(type: string): WorkOrderStatus[] {
    if (type === "active") {
      return [...ACTIVE_WORK_ORDER_STATUSES];
    }

    return [...HISTORY_WORK_ORDER_STATUSES];
  }
}

export type MobileWorkOrderDetail = WorkOrderWithRelations & {
  viewerAccess: MobileWorkOrderViewerAccess;
};

let employeeWorkOrderQueryServiceInstance: EmployeeWorkOrderQueryService | null =
  null;

/** Return the shared employee work-order query service lazily. */
export function getEmployeeWorkOrderQueryService() {
  employeeWorkOrderQueryServiceInstance ??= new EmployeeWorkOrderQueryService();
  return employeeWorkOrderQueryServiceInstance;
}
