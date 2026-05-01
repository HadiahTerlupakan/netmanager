import { isSuperAdmin } from "@/lib/auth";
import { AdminWorkOrderRouteRepository } from "../repositories/AdminWorkOrderRouteRepository";
import type { UserContext } from "./WorkOrderService";
import { AdminWorkOrderActionRouteService } from "./AdminWorkOrderActionRouteService";
import { AdminWorkOrderAnalyticsRouteService } from "./AdminWorkOrderAnalyticsRouteService";
import { AdminWorkOrderFilterBuilder } from "./AdminWorkOrderFilterBuilder";

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
      this.buildAccessFilters.bind(this),
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
      departmentId: profile.departmentId || undefined,
    };
  }

  /** Ambil filter akses department/site berdasarkan permissions admin. */
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
    const hasSiteRestriction = permissionList.includes("workorders:site_only");

    if (hasDepartmentRestriction && !isSuper && !profile.departmentId) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    if (hasSiteRestriction && !isSuper && !profile.siteId) {
      return { unauthorized: false as const, emptyResponse: true as const };
    }

    return {
      unauthorized: false as const,
      emptyResponse: false as const,
      departmentId:
        hasDepartmentRestriction && !isSuper
          ? profile.departmentId || undefined
          : undefined,
      siteId:
        hasSiteRestriction && !isSuper
          ? profile.siteId || undefined
          : undefined,
      userDepartmentId: profile.departmentId || undefined,
      userSiteId: profile.siteId || undefined,
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

  /** Ambil detail material berdasarkan update timeline. */
  async getMaterialDetail(workOrderId: string, updateId: string) {
    return this.repository.findMaterialDetail(workOrderId, updateId);
  }

  /** Kirim reminder manual untuk work order aktif. */
  async sendReminder(input: {
    workOrderId: string;
    customMessage?: string;
    targetDepartmentId?: string;
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
