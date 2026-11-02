import { isSuperAdmin } from "@/lib/auth";
import { filterSitePrisma } from "@/modules/roles/client";
import { UserLookupService } from "@/modules/users";
import {
  resolveAdminScope,
  scopeTanpaData,
  siteDalamScope,
} from "./AdminScopeResolver";

import {
  getLeaveService,
  type CreateLeaveData,
  type LeaveFilters,
  type ServiceResult,
} from "./LeaveService";
import type {
  AccessContext,
  AdminLeaveCreateInput,
  AdminLeaveDeleteInput,
  AdminLeaveListInput,
  AdminLeaveSession,
  AdminLeaveUpdateStatusInput,
  LeaveScopeTarget,
} from "./admin-leave-route.types";

const SITE_ONLY_PERMISSION = "izin:site_only";
const DEPARTMENT_ONLY_PERMISSION = "izin:department_only";
const SITE_FORBIDDEN_MESSAGE = "Dibatasi hanya untuk Site Anda";
const DEPARTMENT_FORBIDDEN_MESSAGE = "Dibatasi hanya untuk Departemen Anda";

/** Service untuk thin controller route admin leave. */
export class AdminLeaveRouteService {
  private readonly leaveService = getLeaveService();
  private readonly userRepository: UserLookupService;

  constructor(userRepository: UserLookupService = new UserLookupService()) {
    this.userRepository = userRepository;
  }

  /** Ambil daftar leave admin sesuai scope permission. */
  async getLeaves(input: AdminLeaveListInput) {
    const scope = await this.resolveScope(input.session);
    const filters = this.buildLeaveFilters(input, scope);
    return this.leaveService.getLeaves(filters, input.page, input.limit);
  }

  /**
   * Buat leave manual oleh admin. Pegawai tujuan wajib berada dalam lingkup
   * `izin:site_only`/`izin:department_only` admin — dulu `userId` apa pun
   * dalam tenant diterima.
   */
  async createLeave(input: AdminLeaveCreateInput) {
    const accessContext = await this.getAccessContext(input.session);
    const targetUser = await this.userRepository.findById(input.userId);
    const scopedError = this.validateScopedAccess(accessContext, {
      siteId: targetUser?.siteId ?? null,
      departmentId: targetUser?.departmentId ?? null,
    });
    if (scopedError) return scopedError;

    return this.leaveService.createLeave(
      this.buildCreateLeaveData(input),
      input.session.user.id,
      input.session.user.tenantId as string,
    );
  }

  /** Ubah status leave setelah validasi akses admin. */
  async updateStatus(input: AdminLeaveUpdateStatusInput) {
    const tenantId = input.session.user.tenantId as string;
    const access = await this.getAccessibleLeave(
      input.id,
      tenantId,
      input.session,
    );
    if (!access.success) return access;

    return input.status === "APPROVED"
      ? this.leaveService.approveLeave(
          input.id,
          input.session.user.id,
          tenantId,
        )
      : this.leaveService.rejectLeave(
          input.id,
          input.session.user.id,
          tenantId,
          input.rejectionReason || "",
        );
  }

  /** Hapus leave setelah validasi akses admin. */
  async deleteLeave(input: AdminLeaveDeleteInput) {
    const tenantId = input.session.user.tenantId as string;
    const access = await this.getAccessibleLeave(
      input.id,
      tenantId,
      input.session,
    );
    if (!access.success) return access;

    return this.leaveService.deleteLeave(
      input.id,
      input.session.user.id,
      tenantId,
    );
  }

  /** Validasi leave dapat diakses admin sesuai scope. */
  private async getAccessibleLeave(
    leaveId: string,
    tenantId: string,
    session: AdminLeaveSession,
  ): Promise<
    ServiceResult<
      NonNullable<
        Awaited<ReturnType<typeof this.leaveService.getLeaveById>>["data"]
      >
    >
  > {
    const leave = await this.leaveService.getLeaveById(leaveId, tenantId);
    if (!leave.success || !leave.data) {
      return leave as ServiceResult<
        NonNullable<
          Awaited<ReturnType<typeof this.leaveService.getLeaveById>>["data"]
        >
      >;
    }

    const accessContext = await this.getAccessContext(session);
    const leaveTarget = this.extractLeaveScopeTarget(leave.data);
    const scopedError = this.validateScopedAccess(accessContext, leaveTarget);
    if (scopedError) return scopedError;

    return leave as ServiceResult<
      NonNullable<
        Awaited<ReturnType<typeof this.leaveService.getLeaveById>>["data"]
      >
    >;
  }

  /**
   * Filter lingkup untuk list admin. Dibatasi tanpa site/departemen → daftar
   * site kosong (`{ in: [] }`), sehingga hasilnya kosong, bukan tanpa filter.
   */
  private async resolveScope(
    session: AdminLeaveSession,
  ): Promise<Pick<LeaveFilters, "siteIds" | "departmentId">> {
    if (isSuperAdmin(session.user)) return {};
    const { scope, tanpaData } = await this.getAccessContext(session);
    if (tanpaData) return { siteIds: [] };
    return {
      siteIds: filterSitePrisma(scope.lingkupSite)?.in,
      departmentId: scope.departmentId,
    };
  }

  private buildLeaveFilters(
    input: AdminLeaveListInput,
    scope: Pick<LeaveFilters, "siteIds" | "departmentId">,
  ) {
    return {
      ...(input.status ? { status: input.status } : {}),
      ...(scope.siteIds ? { siteIds: scope.siteIds } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      tenantId: input.tenantId,
    } as LeaveFilters;
  }

  private buildCreateLeaveData(input: AdminLeaveCreateInput) {
    return {
      userId: input.userId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
      ...(input.replacementDate
        ? { replacementDate: input.replacementDate }
        : {}),
      ...(input.attachmentUrl ? { attachmentUrl: input.attachmentUrl } : {}),
    } as CreateLeaveData;
  }

  private async getAccessContext(
    session: AdminLeaveSession,
  ): Promise<AccessContext> {
    const scope = await resolveAdminScope(
      session.user,
      {
        siteOnly: SITE_ONLY_PERMISSION,
        departmentOnly: DEPARTMENT_ONLY_PERMISSION,
      },
      this.userRepository,
    );
    return { scope, tanpaData: scopeTanpaData(scope) };
  }

  private extractLeaveScopeTarget(leaveData: unknown): LeaveScopeTarget {
    const user = (
      leaveData as {
        user?: { siteId?: string | null; departmentId?: string | null };
      }
    ).user;
    return {
      siteId: user?.siteId ?? null,
      departmentId: user?.departmentId ?? null,
    };
  }

  /**
   * Gagal-tertutup: admin dibatasi tanpa site/departemen, atau target tanpa
   * site/departemen, berada di luar lingkup. Dulu kedua keadaan itu lolos
   * karena perbandingan dilewati saat salah satu sisinya kosong.
   */
  private validateScopedAccess(
    accessContext: AccessContext,
    target: LeaveScopeTarget,
  ): ServiceResult<never> | null {
    if (
      accessContext.tanpaData ||
      this.isOutsideSiteScope(accessContext, target)
    ) {
      return {
        success: false,
        error: SITE_FORBIDDEN_MESSAGE,
        code: "FORBIDDEN",
      };
    }
    if (this.isOutsideDepartmentScope(accessContext, target)) {
      return {
        success: false,
        error: DEPARTMENT_FORBIDDEN_MESSAGE,
        code: "FORBIDDEN",
      };
    }
    return null;
  }

  private isOutsideSiteScope(
    accessContext: AccessContext,
    target: LeaveScopeTarget,
  ) {
    return !siteDalamScope(accessContext.scope, target.siteId);
  }

  private isOutsideDepartmentScope(
    accessContext: AccessContext,
    target: LeaveScopeTarget,
  ) {
    const { departmentId } = accessContext.scope;
    return departmentId !== undefined && target.departmentId !== departmentId;
  }
}
