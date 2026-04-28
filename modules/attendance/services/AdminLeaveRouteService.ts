import type { Session } from "next-auth";
type LeaveStatusValue = string;
type LeaveTypeValue = string;

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { UserLookupService } from "@/modules/users";

import {
  getLeaveService,
  type CreateLeaveData,
  type LeaveFilters,
  type ServiceResult,
} from "./LeaveService";

interface AdminLeaveSession {
  user: Session["user"] & {
    id: string;
    tenantId?: string | null;
  };
}

interface AdminLeaveListInput {
  status?: LeaveStatusValue;
  tenantId: string;
  session: AdminLeaveSession;
}

interface AdminLeaveCreateInput {
  userId: string;
  type: LeaveTypeValue;
  startDate: Date;
  endDate: Date;
  reason: string;
  replacementDate?: Date;
  attachmentUrl?: string;
  session: AdminLeaveSession;
}

interface AdminLeaveUpdateStatusInput {
  id: string;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
  session: AdminLeaveSession;
}

interface AdminLeaveDeleteInput {
  id: string;
  session: AdminLeaveSession;
}

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
    const filters = {
      ...(input.status ? { status: input.status } : {}),
      ...(scope.siteId ? { siteId: scope.siteId } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      tenantId: input.tenantId,
    } as LeaveFilters;

    return this.leaveService.getLeaves(filters);
  }

  /** Buat leave manual oleh admin dengan auto approve. */
  async createLeave(input: AdminLeaveCreateInput) {
    return this.leaveService.createLeave(
      {
        userId: input.userId,
        type: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason,
        ...(input.replacementDate
          ? { replacementDate: input.replacementDate }
          : {}),
        ...(input.attachmentUrl ? { attachmentUrl: input.attachmentUrl } : {}),
      } as CreateLeaveData,
      input.session.user.id,
      input.session.user.tenantId as string,
      true,
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
    if (!access.success) {
      return access;
    }

    if (input.status === "APPROVED") {
      return this.leaveService.approveLeave(
        input.id,
        input.session.user.id,
        tenantId,
      );
    }

    return this.leaveService.rejectLeave(
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
    if (!access.success) {
      return access;
    }

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

    const accessError = await this.validateAccess(session, {
      siteId: null,
      departmentId: null,
    });
    if (accessError) {
      return accessError;
    }

    const scopedError = await this.validateAccess(session, {
      siteId:
        (leave.data as { user?: { siteId?: string | null } }).user?.siteId ??
        null,
      departmentId:
        (leave.data as { user?: { departmentId?: string | null } }).user
          ?.departmentId ?? null,
    });
    if (scopedError) {
      return scopedError;
    }

    return leave as ServiceResult<
      NonNullable<
        Awaited<ReturnType<typeof this.leaveService.getLeaveById>>["data"]
      >
    >;
  }

  /** Resolve scope filter untuk list admin. */
  private async resolveScope(session: AdminLeaveSession) {
    const accessError = await this.validateAccess(session, {
      siteId: null,
      departmentId: null,
    });
    if (accessError) {
      return {};
    }

    if (isSuperAdmin(session.user)) {
      return {};
    }

    const permissions = await getUserPermissions(session.user.id);
    const currentUser = await this.userRepository.findById(session.user.id);

    return {
      ...(permissions.includes(SITE_ONLY_PERMISSION) && currentUser?.siteId
        ? { siteId: currentUser.siteId }
        : {}),
      ...(permissions.includes(DEPARTMENT_ONLY_PERMISSION) &&
      currentUser?.departmentId
        ? { departmentId: currentUser.departmentId }
        : {}),
    };
  }

  /** Validasi akses admin terhadap scope site dan department. */
  private async validateAccess(
    session: AdminLeaveSession,
    target: { siteId: string | null; departmentId: string | null },
  ): Promise<ServiceResult<never> | null> {
    if (isSuperAdmin(session.user)) {
      return null;
    }

    const permissions = await getUserPermissions(session.user.id);
    const currentUser = await this.userRepository.findById(session.user.id);
    if (!currentUser) {
      return { success: false, error: "Unauthorized", code: "UNAUTHORIZED" };
    }

    if (
      permissions.includes(SITE_ONLY_PERMISSION) &&
      currentUser.siteId &&
      target.siteId &&
      currentUser.siteId !== target.siteId
    ) {
      return {
        success: false,
        error: SITE_FORBIDDEN_MESSAGE,
        code: "FORBIDDEN",
      };
    }

    if (
      permissions.includes(DEPARTMENT_ONLY_PERMISSION) &&
      currentUser.departmentId &&
      target.departmentId &&
      currentUser.departmentId !== target.departmentId
    ) {
      return {
        success: false,
        error: DEPARTMENT_FORBIDDEN_MESSAGE,
        code: "FORBIDDEN",
      };
    }

    return null;
  }
}
