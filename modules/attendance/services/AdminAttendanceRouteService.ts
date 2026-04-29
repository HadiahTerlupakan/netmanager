import type { Prisma } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { getTimezone } from "@/lib/utils/get-timezone";
import { prisma } from "@/modules/database";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { AdminAttendanceListService } from "./AdminAttendanceListService";
import { syncAttendanceDependencies } from "./AdminAttendanceSyncService";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

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
      return {
        ok: false as const,
        code: 400,
        message: "Tenant ID tidak ditemukan",
      };
    }

    const attendanceWhere: Prisma.AttendanceWhereInput = {
      tenantId,
      id: { in: ids },
    };
    const permissions = await getUserPermissions(user.id);
    const superAdmin = isSuperAdmin(user);

    if (!superAdmin) {
      const currentUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true },
      });
      const userScope = this.buildDeletionUserScope(
        permissions,
        currentUser?.siteId,
        currentUser?.departmentId,
      );
      if (userScope.id === NO_SCOPE_MATCH) {
        attendanceWhere.user = { id: NO_SCOPE_MATCH };
      } else if (Object.keys(userScope).length > 0) {
        attendanceWhere.user = userScope;
      }
    }

    const deletableAttendances = await this.attendanceRepository.findMany({
      where: attendanceWhere,
      select: { id: true },
    });
    const deletedIds = deletableAttendances.map((attendance) => attendance.id);

    if (deletedIds.length > 0) {
      await this.attendanceRepository.deleteMany({
        tenantId,
        id: { in: deletedIds },
      });
    }

    return {
      ok: true as const,
      data: {
        requestedCount: ids.length,
        deletedCount: deletedIds.length,
        deletedIds,
        skippedCount: ids.length - deletedIds.length,
      },
    };
  }

  /** Build user scope for attendance deletion. */
  private buildDeletionUserScope(
    permissions: string[],
    siteId: string | null | undefined,
    departmentId: string | null | undefined,
  ) {
    const userScope: Prisma.UserWhereInput = {};
    const hasSiteOnlyScope = permissions.includes("attendance:site_only");
    const hasDepartmentOnlyScope = permissions.includes(
      "attendance:department_only",
    );

    if (hasSiteOnlyScope && !siteId) return { id: NO_SCOPE_MATCH };
    if (hasDepartmentOnlyScope && !departmentId) return { id: NO_SCOPE_MATCH };
    if (hasSiteOnlyScope) userScope.siteId = siteId;
    if (hasDepartmentOnlyScope) userScope.departmentId = departmentId;
    return userScope;
  }
}
