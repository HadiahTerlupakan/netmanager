import type { Prisma } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTimezone } from "@/lib/utils/get-timezone";
import { prisma } from "@/modules/database";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AdminAttendanceListService } from "./AdminAttendanceListService";
import { syncAttendanceDependencies } from "./AdminAttendanceSyncService";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

type ScopedAdminUser = {
  siteId: string | null | undefined;
  departmentId: string | null | undefined;
};

export class AdminAttendanceRouteService {
  private readonly attendanceRepository: IAttendanceRepository;
  private readonly listService: AdminAttendanceListService;

  constructor(
    attendanceRepository: IAttendanceRepository = new AttendanceRepository(),
  ) {
    this.attendanceRepository = attendanceRepository;
    this.listService = new AdminAttendanceListService(attendanceRepository);
  }

  /** Build admin attendance response with filtering, summary, and export support. */
  async getAdminAttendances(
    user: AdminAttendanceUser,
    input: AttendanceFilterInput,
  ) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      return {
        type: "error" as const,
        code: 400,
        message: "Tenant ID tidak ditemukan",
      };
    }

    const timezone = await getTimezone(tenantId);
    await syncAttendanceDependencies(input, timezone, tenantId);
    return this.listService.getAdminAttendances(user, input, timezone);
  }

  /** Delete multiple attendance records with scope enforcement. */
  async deleteAdminAttendances(user: AdminAttendanceUser, ids: string[]) {
    const tenantId = user.tenantId;
    if (!tenantId) {
      return this.createTenantError();
    }

    const attendanceWhere = await this.buildDeletionWhere(user, ids, tenantId);
    const deletedIds = await this.findDeletableAttendanceIds(attendanceWhere);

    if (deletedIds.length > 0) {
      await this.attendanceRepository.deleteMany({
        tenantId,
        id: { in: deletedIds },
      });
    }

    return this.createDeletionResult(ids, deletedIds);
  }

  /** Build user scope for attendance deletion. */
  private buildDeletionUserScope(
    permissions: string[],
    currentUser: ScopedAdminUser,
  ) {
    const userScope: Prisma.UserWhereInput = {};
    const hasSiteOnlyScope = permissions.includes("attendance:site_only");
    const hasDepartmentOnlyScope = permissions.includes(
      "attendance:department_only",
    );

    if (hasSiteOnlyScope && !currentUser.siteId) return { id: NO_SCOPE_MATCH };
    if (hasDepartmentOnlyScope && !currentUser.departmentId) {
      return { id: NO_SCOPE_MATCH };
    }
    if (hasSiteOnlyScope) userScope.siteId = currentUser.siteId;
    if (hasDepartmentOnlyScope)
      userScope.departmentId = currentUser.departmentId;
    return userScope;
  }

  private createTenantError() {
    return {
      ok: false as const,
      code: 400,
      message: "Tenant ID tidak ditemukan",
    };
  }

  private async buildDeletionWhere(
    user: AdminAttendanceUser,
    ids: string[],
    tenantId: string,
  ) {
    const attendanceWhere: Prisma.AttendanceWhereInput = {
      tenantId,
      id: { in: ids },
    };
    if (isSuperAdmin(user)) return attendanceWhere;

    const [permissions, currentUser] = await Promise.all([
      getUserPermissions(user.id),
      this.findCurrentUserScope(user.id),
    ]);
    const userScope = this.buildDeletionUserScope(permissions, currentUser);

    if (userScope.id === NO_SCOPE_MATCH) {
      attendanceWhere.user = { id: NO_SCOPE_MATCH };
      return attendanceWhere;
    }
    if (Object.keys(userScope).length > 0) {
      attendanceWhere.user = userScope;
    }
    return attendanceWhere;
  }

  private async findCurrentUserScope(userId: string): Promise<ScopedAdminUser> {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { siteId: true, departmentId: true },
    });

    return {
      siteId: currentUser?.siteId,
      departmentId: currentUser?.departmentId,
    };
  }

  private async findDeletableAttendanceIds(where: Prisma.AttendanceWhereInput) {
    const attendances = await this.attendanceRepository.findMany({
      where,
      select: { id: true },
    });
    return attendances.map((attendance) => attendance.id);
  }

  private createDeletionResult(requestedIds: string[], deletedIds: string[]) {
    return {
      ok: true as const,
      data: {
        requestedCount: requestedIds.length,
        deletedCount: deletedIds.length,
        deletedIds,
        skippedCount: requestedIds.length - deletedIds.length,
      },
    };
  }
}
