import type { Prisma } from "../repositories/prisma-boundary";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import {
  buildAttendanceEvaluationKey,
  buildSummaryFromAttendances,
  enrichAttendanceRow,
  filterAttendancesByCanonicalStatusDetail,
  getAttendanceEvaluationMap,
  isCanonicalStatusDetail,
} from "./AdminAttendanceEvaluationHelper";
import { buildExportRows, toCsvResponse } from "./AdminAttendanceExportService";
import { AttendanceTrackingReportService } from "./AttendanceTrackingReportService";
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
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly trackingReport: AttendanceTrackingReportService = new AttendanceTrackingReportService(),
  ) {}

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
    const trackingOffMinutes =
      await this.trackingReport.trackingOffMinutes(filteredAttendances);
    return {
      type: "response" as const,
      response: toCsvResponse(
        buildExportRows(
          filteredAttendances,
          evaluationMap,
          timezone,
          trackingOffMinutes,
        ),
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
    const MAX_CANONICAL_FETCH = 5000;
    const allAttendances = filterAttendancesByJoinDate(
      await this.attendanceRepository.findMany({
        where,
        include,
        orderBy: { checkIn: "desc" },
        take: MAX_CANONICAL_FETCH,
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
    const page = filteredAttendances.slice(skip, skip + input.limit);
    const trackingOffMinutes =
      await this.trackingReport.trackingOffMinutes(page);
    return {
      type: "paginated" as const,
      data: page.map((item) => ({
        ...enrichAttendanceRow(
          item,
          evaluationMap.get(buildAttendanceEvaluationKey(item, timezone)),
        ),
        trackingOffMinutes: trackingOffMinutes.get(item.id) ?? null,
      })),
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
      this.attendanceRepository.groupByStatus(activeAttendanceWhere),
    ]);

    const page = filterAttendancesByJoinDate(rawPaginatedData);
    const trackingOffMinutes =
      await this.trackingReport.trackingOffMinutes(page);
    return {
      type: "paginated" as const,
      data: page.map((item) => ({
        ...enrichAttendanceRow(item, null),
        trackingOffMinutes: trackingOffMinutes.get(item.id) ?? null,
      })),
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
