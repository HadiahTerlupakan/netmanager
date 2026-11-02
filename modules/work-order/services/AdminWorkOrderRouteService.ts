import { isSuperAdmin } from "@/lib/auth";
import { tanpaDataSamaSekali } from "@/modules/roles/client";
import type { WorkOrderRequestFilters } from "../domain/ports/IWorkOrderRepository";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import type { UserContext } from "./WorkOrderService";
import { AdminWorkOrderActionRouteService } from "./AdminWorkOrderActionRouteService";
import { AdminWorkOrderAnalyticsRouteService } from "./AdminWorkOrderAnalyticsRouteService";
import { AdminWorkOrderFilterBuilder } from "./AdminWorkOrderFilterBuilder";
import { buildWorkOrderDashboardAccessFilters } from "./admin-work-order-dashboard.helpers";
import {
  resolveWorkOrderSiteScope,
  toSiteScopeIds,
} from "./work-order-site-access";

type PermissionList = string[] | undefined;
type WorkOrderRequestAction = "APPROVE" | "REJECT";

interface WorkOrderApprovalInput {
  workOrderId: string;
  action: WorkOrderRequestAction;
  actor: { id: string; role?: string; name?: string | null };
  permissions?: PermissionList;
  reason?: string;
}

/** Service route admin untuk orkestrasi work order tanpa akses database di route. */
export class AdminWorkOrderRouteService {
  private _repository: AdminWorkOrderRouteRepository | null = null;
  private _filterBuilder: AdminWorkOrderFilterBuilder | null = null;
  private _actionService: AdminWorkOrderActionRouteService | null = null;
  private _analyticsService: AdminWorkOrderAnalyticsRouteService | null = null;

  private get repository(): AdminWorkOrderRouteRepository {
    this._repository ??= new AdminWorkOrderRouteRepository();
    return this._repository;
  }

  private get filterBuilder(): AdminWorkOrderFilterBuilder {
    this._filterBuilder ??= new AdminWorkOrderFilterBuilder();
    return this._filterBuilder;
  }

  private get actionService(): AdminWorkOrderActionRouteService {
    this._actionService ??= new AdminWorkOrderActionRouteService(
      this.repository,
      this.getUserContext.bind(this),
    );
    return this._actionService;
  }

  private get analyticsService(): AdminWorkOrderAnalyticsRouteService {
    this._analyticsService ??= new AdminWorkOrderAnalyticsRouteService(
      this.repository,
      this.buildDashboardAccessFilters.bind(this),
    );
    return this._analyticsService;
  }

  /** Ambil user context lengkap untuk route admin. */
  async getUserContext(
    user: {
      id: string;
      role?: string;
      name?: string | null;
    },
    permissions?: PermissionList,
  ): Promise<UserContext | null> {
    const profile = await this.repository.findUserProfile(user.id);

    if (!profile) {
      return null;
    }

    return {
      id: user.id,
      role: user.role,
      name: user.name || undefined,
      permissions,
      siteId: profile.siteId || undefined,
      siteIds: profile.siteIds,
      departmentId: profile.departmentId || undefined,
    };
  }

  /**
   * Ambil filter akses department/site berdasarkan permissions admin.
   * Lingkup site mencakup SELURUH site pengguna (`siteIds`), bukan hanya site
   * utamanya.
   */
  async buildAccessFilters(
    user: { id: string; role?: string },
    permissions?: PermissionList,
  ) {
    const profile = await this.repository.findUserProfile(user.id);

    if (!profile) {
      return { unauthorized: true as const };
    }

    const permissionList = permissions || [];
    const isSuper = isSuperAdmin({ role: user.role });
    const hasDepartmentRestriction = permissionList.includes(
      "workorders:department_only",
    );
    const lingkupSite = resolveWorkOrderSiteScope({
      permissions: permissionList,
      owner: profile,
      isSuperAdmin: isSuper,
    });

    if (hasDepartmentRestriction && !isSuper && !profile.departmentId) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    if (tanpaDataSamaSekali(lingkupSite)) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    return {
      unauthorized: false as const,
      emptyResponse: false as const,
      departmentId:
        hasDepartmentRestriction && !isSuper
          ? profile.departmentId || undefined
          : undefined,
      siteIds: toSiteScopeIds(lingkupSite),
      userDepartmentId: profile.departmentId || undefined,
      userSiteId: profile.siteId || undefined,
      userSiteIds: profile.siteIds,
    };
  }

  /**
   * Bangun filter daftar permintaan WO: lingkup `*_only` pengguna menang atas
   * filter query string; site pilihan di luar lingkup tidak melebarkan hasil.
   */
  buildRequestListFilters(input: {
    access: { departmentId?: string; siteIds?: string[] };
    searchParams: URLSearchParams;
  }): WorkOrderRequestFilters {
    const { access, searchParams } = input;
    const search = searchParams.get("search") || undefined;
    const siteId = searchParams.get("siteId") || undefined;
    const departmentId =
      access.departmentId || searchParams.get("departmentId") || undefined;

    return {
      ...(search ? { search } : {}),
      ...(siteId ? { siteId } : {}),
      ...(access.siteIds ? { siteIds: access.siteIds } : {}),
      ...(departmentId ? { departmentId } : {}),
    };
  }

  /**
   * Ambil filter akses department/site untuk route analitik admin.
   *
   * Route analitik dijaga `work_order_dashboard:read`, jadi pembatasannya
   * memakai helper dashboard yang membaca `work_order_dashboard:*_only`
   * sekaligus `workorders:*_only`. Role terbatas tanpa site/departemen
   * mendapat `emptyResponse` (fail closed).
   */
  async buildDashboardAccessFilters(
    user: { id: string; role?: string; isSuperAdmin?: boolean },
    permissions?: PermissionList,
  ) {
    const profile = await this.repository.findUserProfile(user.id);

    if (!profile) {
      return { unauthorized: true as const };
    }

    return {
      unauthorized: false as const,
      ...buildWorkOrderDashboardAccessFilters({
        role: user.role,
        isSuperAdmin: user.isSuperAdmin,
        permissions: permissions ?? [],
        departmentId: profile.departmentId,
        siteId: profile.siteId,
        siteIds: profile.siteIds,
      }),
    };
  }

  /** Bangun filter list work order dari query string route admin. */
  buildListFilters(searchParams: URLSearchParams) {
    return this.filterBuilder.buildListFilters(searchParams);
  }

  /** Approve atau reject request work order beserta notifikasi peminta. */
  async processRequestApproval(input: WorkOrderApprovalInput) {
    return this.actionService.processRequestApproval(input);
  }

  /** Tambahkan komentar WO dan kirim notifikasi side effect. */
  async addComment(input: {
    workOrderId: string;
    message: string;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    return this.actionService.addComment(input);
  }

  /** Tambahkan task WO dan jalankan side effect notifikasi. */
  async addTask(input: {
    workOrderId: string;
    title: string;
    description?: string;
    order?: number;
    actor: { id: string; name?: string | null; role?: string };
    permissions?: PermissionList;
  }) {
    return this.actionService.addTask(input);
  }

  /** Tambahkan material dengan resolusi gudang default user bila perlu. */
  async addMaterial(input: {
    workOrderId: string;
    barangId: string;
    quantity: number;
    notes?: string;
    gudangId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    return this.actionService.addMaterial(input);
  }

  /** Ambil detail material berdasarkan update timeline, dengan cek lingkup WO. */
  async getMaterialDetail(input: {
    workOrderId: string;
    updateId: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    return this.actionService.getMaterialDetail(input);
  }

  /** Kirim reminder manual untuk work order aktif. */
  async sendReminder(input: {
    workOrderId: string;
    customMessage?: string;
    targetDepartmentId?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    return this.actionService.sendReminder(input);
  }

  /** Hapus permanen atau cancel work order dengan side effect terkait. */
  async deleteWorkOrder(input: {
    workOrderId: string;
    permanent?: boolean;
    reason?: string;
    actor: { id: string; role?: string; name?: string | null };
    permissions?: PermissionList;
  }) {
    return this.actionService.deleteWorkOrder(input);
  }

  /** Ambil statistik response stats untuk route admin. */
  async getResponseStats(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getResponseStats(input);
  }

  /** Ambil recent work orders dengan access filter admin. */
  async getRecentWorkOrders(input: {
    limit?: number;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getRecentWorkOrders(input);
  }

  /** Ambil workload departemen dengan filtering akses admin. */
  async getDepartmentWorkload(input: {
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getDepartmentWorkload(input);
  }

  /** Ambil statistik overview dengan filtering akses admin. */
  async getStats(input: {
    filters: { departmentId?: string; assignedToId?: string };
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getStats(input);
  }

  /** Ambil summary top performer sesuai periode. */
  async getTopPerformers(input: {
    period?: string;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getTopPerformers(input);
  }

  /** Ambil data analytics trend dengan access filter admin. */
  async getTrends(input: {
    startDate: Date;
    endDate: Date;
    user: { id: string; role?: string };
    permissions?: PermissionList;
  }) {
    return this.analyticsService.getTrends(input);
  }
}

let adminWorkOrderRouteServiceInstance: AdminWorkOrderRouteService | null =
  null;

/** Return the shared admin work-order route service lazily. */
export function getAdminWorkOrderRouteService() {
  adminWorkOrderRouteServiceInstance ??= new AdminWorkOrderRouteService();
  return adminWorkOrderRouteServiceInstance;
}
