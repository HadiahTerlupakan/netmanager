import type { Prisma } from "../repositories/prisma-boundary";
import { isSuperAdmin } from "@/lib/auth";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { AdminAttendanceListService } from "./AdminAttendanceListService";
import { resolveAdminScope } from "./AdminScopeResolver";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

export class AdminAttendanceRouteService {
  private readonly attendanceRepository: AttendanceRepository;
  private readonly listService: AdminAttendanceListService;

  constructor(
    attendanceRepository: AttendanceRepository = new AttendanceRepository(),
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
    siteId: string | undefined,
    departmentId: string | undefined,
  ) {
    const userScope: Prisma.UserWhereInput = {};

    if (siteId === undefined && departmentId === undefined) return userScope;
    if (siteId !== undefined && !siteId) return { id: NO_SCOPE_MATCH };
    if (departmentId !== undefined && !departmentId)
      return { id: NO_SCOPE_MATCH };
    if (siteId) userScope.siteId = siteId;
    if (departmentId) userScope.departmentId = departmentId;
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

    const scope = await resolveAdminScope(user, {
      siteOnly: "attendance:site_only",
      departmentOnly: "attendance:department_only",
    });
    const userScope = this.buildDeletionUserScope(
      scope.siteId,
      scope.departmentId,
    );

    if (userScope.id === NO_SCOPE_MATCH) {
      attendanceWhere.user = { id: NO_SCOPE_MATCH };
      return attendanceWhere;
    }
    if (Object.keys(userScope).length > 0) {
      attendanceWhere.user = userScope;
    }
    return attendanceWhere;
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
