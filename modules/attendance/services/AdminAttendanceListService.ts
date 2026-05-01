import type { Prisma } from "../repositories/prisma-boundary";
import { prisma } from "@/modules/database";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import {
  buildAttendanceEvaluationKey,
  buildSummaryFromAttendances,
  enrichAttendanceRow,
  filterAttendancesByCanonicalStatusDetail,
  getAttendanceEvaluationMap,
  isCanonicalStatusDetail,
} from "./AdminAttendanceEvaluationHelper";
import { buildExportRows, toCsvResponse } from "./AdminAttendanceExportService";
import {
  buildAdminAttendanceWhere,
  buildIncludeUser,
  filterAttendancesByJoinDate,
} from "./AdminAttendanceFilterService";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

/** Bangun response list/export attendance admin. */
export class AdminAttendanceListService {
  constructor(private readonly attendanceRepository: IAttendanceRepository) {}

  /** Ambil data attendance admin sesuai filter, pagination, dan mode export. */
  async getAdminAttendances(
    user: AdminAttendanceUser,
    input: AttendanceFilterInput,
    timezone: string,
  ) {
    const tenantId = user.tenantId!;
    const where = await buildAdminAttendanceWhere(user, input, timezone);
    const activeAttendanceWhere = {
      ...where,
      correctedAt: null,
    } as Prisma.AttendanceWhereInput;
    const includeUser = buildIncludeUser();
    const skip = (input.page - 1) * input.limit;

    if (input.export === "true") {
      return this.getExportResponse(
        activeAttendanceWhere,
        includeUser,
        input,
        tenantId,
        timezone,
      );
    }
    if (isCanonicalStatusDetail(input.statusDetail)) {
      return this.getCanonicalPaginatedResponse(
        where,
        includeUser,
        input,
        tenantId,
        timezone,
        skip,
      );
    }
    return this.getStandardPaginatedResponse(
      where,
      activeAttendanceWhere,
      includeUser,
      input,
      skip,
    );
  }

  private async getExportResponse(
    where: Prisma.AttendanceWhereInput,
    include: ReturnType<typeof buildIncludeUser>,
    input: AttendanceFilterInput,
    tenantId: string,
    timezone: string,
  ) {
    const allAttendances = filterAttendancesByJoinDate(
      await this.attendanceRepository.findMany({
        where,
        include,
        orderBy: { checkIn: "desc" },
      }),
    );
    const evaluationMap = await getAttendanceEvaluationMap(
      this.attendanceRepository,
      allAttendances,
      tenantId,
      timezone,
    );
    const filteredAttendances = filterAttendancesByCanonicalStatusDetail(
      allAttendances,
      evaluationMap,
      input.statusDetail,
      timezone,
    );
    return {
      type: "response" as const,
      response: toCsvResponse(
        buildExportRows(filteredAttendances, evaluationMap, timezone),
      ),
    };
  }

  private async getCanonicalPaginatedResponse(
    where: Prisma.AttendanceWhereInput,
    include: ReturnType<typeof buildIncludeUser>,
    input: AttendanceFilterInput,
    tenantId: string,
    timezone: string,
    skip: number,
  ) {
    const allAttendances = filterAttendancesByJoinDate(
      await this.attendanceRepository.findMany({
        where,
        include,
        orderBy: { checkIn: "desc" },
      }),
    );
    const evaluationMap = await getAttendanceEvaluationMap(
      this.attendanceRepository,
      allAttendances,
      tenantId,
      timezone,
    );
    const filteredAttendances = filterAttendancesByCanonicalStatusDetail(
      allAttendances,
      evaluationMap,
      input.statusDetail,
      timezone,
    );
    return {
      type: "paginated" as const,
      data: filteredAttendances
        .slice(skip, skip + input.limit)
        .map((item) =>
          enrichAttendanceRow(
            item,
            evaluationMap.get(buildAttendanceEvaluationKey(item, timezone)),
          ),
        ),
      meta: {
        page: input.page,
        limit: input.limit,
        total: filteredAttendances.length,
        summary: buildSummaryFromAttendances(
          filteredAttendances.filter((item) => !item.correctedAt),
          evaluationMap,
          timezone,
        ),
      },
    };
  }

  private async getStandardPaginatedResponse(
    where: Prisma.AttendanceWhereInput,
    activeAttendanceWhere: Prisma.AttendanceWhereInput,
    include: ReturnType<typeof buildIncludeUser>,
    input: AttendanceFilterInput,
    skip: number,
  ) {
    const [rawPaginatedData, total, statusGroups] = await Promise.all([
      this.attendanceRepository.findMany({
        where,
        include,
        orderBy: { checkIn: "desc" },
        skip,
        take: input.limit,
      }),
      this.attendanceRepository.count(where),
      prisma.attendance.groupBy({
        by: ["status"],
        where: activeAttendanceWhere,
        _count: { _all: true },
      }),
    ]);

    return {
      type: "paginated" as const,
      data: filterAttendancesByJoinDate(rawPaginatedData).map((item) =>
        enrichAttendanceRow(item, null),
      ),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        summary: statusGroups.reduce(
          (summary, current) => {
            summary[current.status] = current._count._all;
            return summary;
          },
          {} as Record<string, number>,
        ),
      },
    };
  }
}
