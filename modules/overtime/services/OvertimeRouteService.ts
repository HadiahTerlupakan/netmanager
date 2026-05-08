import type { Session } from "next-auth";
import type { OvertimeStatusValue } from "../domain/entities/OvertimeEntity";

import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { UserLookupService } from "@/modules/users";

import { OvertimeMapper } from "../mappers/OvertimeMapper";
import { OvertimeService } from "./OvertimeService";

interface RouteSession {
  user: Session["user"] & {
    id: string;
    tenantId?: string | null;
  };
}

interface AdminOvertimeListInput {
  session: RouteSession;
  page: number;
  limit: number;
  status?: OvertimeStatusValue;
  holidayType?: string;
  siteId?: string;
  departmentId?: string;
  startDate?: string | null;
  endDate?: string | null;
}

interface AdminOvertimeMutationInput {
  id: string;
  session: RouteSession;
}

interface AdminOvertimeUpdateInput extends AdminOvertimeMutationInput {
  reason?: string;
  startTime?: string;
  endTime?: string;
}

const SITE_ONLY_PERMISSION = "lembur:site_only";
const DEPARTMENT_ONLY_PERMISSION = "lembur:department_only";
const NOT_FOUND_MESSAGE = "Data lembur tidak ditemukan";

/** Service untuk thin controller route overtime. */
export class OvertimeRouteService {
  private readonly overtimeService: OvertimeService;
  private readonly userRepository: UserLookupService;

  constructor(
    overtimeService: OvertimeService = new OvertimeService(),
    userRepository: UserLookupService = new UserLookupService(),
  ) {
    this.overtimeService = overtimeService;
    this.userRepository = userRepository;
  }

  /** Ambil daftar overtime admin sesuai scope permission. */
  async getAdminList(input: AdminOvertimeListInput) {
    const filters = await this.buildScopedFilters(input);
    const [entities, total, summary] = await Promise.all([
      this.overtimeService.findAll(filters),
      this.overtimeService.count(filters),
      this.overtimeService.countByStatus(filters),
    ]);

    const enrichedEntities = await this.overtimeService.enrichOvertimeFlags(
      entities,
      input.session.user.tenantId ?? undefined,
    );

    return {
      data: enrichedEntities.map((entity) =>
        OvertimeMapper.toAdminDetailPayload(entity),
      ),
      summary,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  /** Ambil detail overtime admin dengan validasi access scope. */
  async getAdminDetail(input: AdminOvertimeMutationInput) {
    const overtime = await this.getAccessibleOvertime(input.id, input.session);
    return OvertimeMapper.toAdminDetailPayload(overtime);
  }

  /** Update data overtime admin non-verifikasi. */
  async updateAdminOvertime(input: AdminOvertimeUpdateInput) {
    await this.getAccessibleOvertime(input.id, input.session);

    return this.overtimeService.updateOvertime(input.id, {
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.startTime ? { startTime: new Date(input.startTime) } : {}),
      ...(input.endTime ? { endTime: new Date(input.endTime) } : {}),
    });
  }

  /** Setujui overtime admin setelah validasi akses. */
  async approve(input: AdminOvertimeMutationInput) {
    await this.getAccessibleOvertime(input.id, input.session);
    return this.overtimeService.approveRequest(
      input.id,
      input.session.user.id || "system",
    );
  }

  /** Tolak overtime admin setelah validasi akses. */
  async reject(input: AdminOvertimeMutationInput & { reason: string }) {
    await this.getAccessibleOvertime(input.id, input.session);
    return this.overtimeService.rejectRequest(input.id, input.reason);
  }

  /** Hapus overtime admin setelah validasi akses. */
  async delete(input: AdminOvertimeMutationInput) {
    await this.getAccessibleOvertime(input.id, input.session);
    await this.overtimeService.deleteOvertime(input.id);
  }

  /** Ambil context mobile overtime. */
  async getMobileContext(userId: string, tenantId: string) {
    const [history, attendanceState, holidayInfo] = await Promise.all([
      this.overtimeService.getHistory(userId, tenantId),
      this.overtimeService.getTodayAttendanceState(userId, tenantId),
      this.overtimeService.getTodayHolidayInfo(tenantId),
    ]);

    return {
      history,
      hasCheckedOut: attendanceState.hasCheckedOut,
      holidayInfo,
    };
  }

  /** Bangun filter overtime admin dengan scope RBAC. */
  private async buildScopedFilters(input: AdminOvertimeListInput) {
    const scope = await this.resolveScope(input.session);
    const filters: {
      skip: number;
      take: number;
      status?: OvertimeStatusValue;
      holidayType?: string;
      siteId?: string;
      departmentId?: string;
      startDate?: Date;
      endDate?: Date;
      tenantId?: string;
    } = {
      skip: (input.page - 1) * input.limit,
      take: input.limit,
      status: input.status,
      holidayType: input.holidayType,
      tenantId: input.session.user.tenantId ?? undefined,
    };

    if (input.siteId) filters.siteId = input.siteId;
    if (input.departmentId) filters.departmentId = input.departmentId;
    if (scope.siteId) filters.siteId = scope.siteId;
    if (scope.departmentId) filters.departmentId = scope.departmentId;

    if (input.startDate && input.endDate) {
      filters.startDate = toStartOfDay(new Date(input.startDate));
      filters.endDate = toEndOfDay(new Date(input.endDate));
    }

    return filters;
  }

  /** Ambil overtime dan validasi access admin. */
  private async getAccessibleOvertime(id: string, session: RouteSession) {
    const overtime = await this.overtimeService.getOvertimeById(
      id,
      session.user.tenantId ?? undefined,
    );
    if (!overtime) {
      throw new Error(NOT_FOUND_MESSAGE);
    }

    if (isSuperAdmin(session.user)) {
      return overtime;
    }

    const permissions = await getUserPermissions(session.user.id);
    const currentUser = await this.userRepository.findById(session.user.id);
    if (!currentUser) {
      throw new Error("Unauthorized");
    }

    if (
      permissions.includes(SITE_ONLY_PERMISSION) &&
      currentUser.siteId &&
      overtime.user?.siteId !== currentUser.siteId
    ) {
      throw new Error(NOT_FOUND_MESSAGE);
    }

    if (
      permissions.includes(DEPARTMENT_ONLY_PERMISSION) &&
      currentUser.departmentId &&
      overtime.user?.departmentId !== currentUser.departmentId
    ) {
      throw new Error(NOT_FOUND_MESSAGE);
    }

    return overtime;
  }

  /** Resolve scope filter berdasarkan permission admin. */
  private async resolveScope(session: RouteSession) {
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
}
