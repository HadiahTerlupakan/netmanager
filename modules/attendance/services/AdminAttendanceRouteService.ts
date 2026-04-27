import { NextResponse } from "next/server";
import type { Prisma, AttendanceStatus } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import {
  getDayOffDisplayLabel,
  getPermitDisplayLabel,
  isHistoricalAutoCheckoutAbsence,
} from "@/lib/attendance-display";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";
import { LeaveService } from "./LeaveService";
import { AbsenceService } from "./AbsenceService";
import { prisma } from "@/modules/database";

const CANONICAL_STATUS_DETAILS = new Set([
  "CUTI",
  "IZIN",
  "TUKAR_LIBUR",
  "HARI_LIBUR",
  "HARI_OFF",
]);
const CSV_FILENAME = 'attachment; filename="absensi.csv"';
const NO_SCOPE_MATCH = "__NO_SCOPE_MATCH__";

type AttendanceEvaluationLookupRow = Awaited<
  ReturnType<IAttendanceRepository["findManyEvaluationLookups"]>
>[number];

type AdminAttendanceRow = {
  tenantId: string | null;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  notes?: string | null;
  correctedAt?: Date | null;
  correctionReason?: string | null;
  correctionReplacementAttendanceId?: string | null;
  correctionSourceAttendanceId?: string | null;
  correctionSource?: string | null;
};

type AdminAttendanceUser = {
  id: string;
  tenantId?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  isSuperAdmin?: boolean;
};

type AttendanceFilterInput = {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  userId?: string;
  siteId?: string;
  departmentId?: string;
  status?: string;
  statusDetail?: string;
  search?: string;
  export?: string;
};

function isCanonicalStatusDetail(statusDetail?: string) {
  return Boolean(statusDetail && CANONICAL_STATUS_DETAILS.has(statusDetail));
}

function buildAttendanceEvaluationKey(
  attendance: Pick<
    AdminAttendanceRow,
    "tenantId" | "userId" | "checkIn" | "checkOut"
  >,
  timezone: string,
) {
  const workDate = toStartOfDay(
    attendance.checkOut ?? attendance.checkIn,
    timezone,
  );
  return `${attendance.tenantId ?? ""}:${attendance.userId}:${workDate.toISOString()}`;
}

function buildEvaluationLookupKey(
  evaluation: AttendanceEvaluationLookupRow,
  timezone: string,
) {
  const normalizedWorkDate = toStartOfDay(evaluation.workDate, timezone);
  return `${evaluation.tenantId}:${evaluation.userId}:${normalizedWorkDate.toISOString()}`;
}

async function getAttendanceEvaluationMap(
  repository: IAttendanceRepository,
  attendances: AdminAttendanceRow[],
  tenantId: string,
  timezone: string,
): Promise<Map<string, AttendanceEvaluationLookupRow>> {
  if (attendances.length === 0) {
    return new Map<string, AttendanceEvaluationLookupRow>();
  }

  const userIds = [...new Set(attendances.map((item) => item.userId))];
  const workDates = [
    ...new Set(
      attendances.map((item) =>
        toStartOfDay(item.checkOut ?? item.checkIn, timezone).toISOString(),
      ),
    ),
  ].map((value) => new Date(value));

  const evaluations = await repository.findManyEvaluationLookups({
    tenantId,
    userIds,
    workDates,
  });

  return new Map(
    evaluations.map((evaluation) => [
      buildEvaluationLookupKey(evaluation, timezone),
      evaluation,
    ]),
  );
}

function matchesCanonicalStatusDetail(
  statusDetail: string | undefined,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  if (!statusDetail) return true;
  if (statusDetail === "CUTI") {
    return (
      evaluation?.finalStatus === "PERMIT" && evaluation.leaveState === "CUTI"
    );
  }
  if (statusDetail === "IZIN") {
    return (
      evaluation?.finalStatus === "PERMIT" &&
      Boolean(evaluation.leaveState) &&
      evaluation.leaveState !== "CUTI"
    );
  }
  if (statusDetail === "TUKAR_LIBUR") {
    return (
      evaluation?.finalStatus === "DAY_OFF" && Boolean(evaluation.leaveState)
    );
  }
  if (statusDetail === "HARI_LIBUR") {
    return (
      evaluation?.finalStatus === "DAY_OFF" && Boolean(evaluation.holidayState)
    );
  }
  if (statusDetail === "HARI_OFF") {
    return (
      evaluation?.finalStatus === "DAY_OFF" &&
      !evaluation.holidayState &&
      !evaluation.leaveState
    );
  }
  return true;
}

function filterAttendancesByCanonicalStatusDetail<T extends AdminAttendanceRow>(
  attendances: T[],
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  statusDetail: string | undefined,
  timezone: string,
) {
  if (!isCanonicalStatusDetail(statusDetail)) return attendances;
  return attendances.filter((attendance) => {
    const evaluation = evaluationMap.get(
      buildAttendanceEvaluationKey(attendance, timezone),
    );
    return matchesCanonicalStatusDetail(statusDetail, evaluation);
  });
}

function getEffectiveAttendanceStatus(
  attendance: Pick<AdminAttendanceRow, "status">,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  return evaluation?.finalStatus ?? attendance.status;
}

function getAttendanceDisplayStatus(
  attendance: AdminAttendanceRow,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  const effectiveStatus = getEffectiveAttendanceStatus(attendance, evaluation);
  const isHistoricalNoCheckout = isHistoricalAutoCheckoutAbsence(attendance);

  if (effectiveStatus === "SICK") return "SAKIT";
  if (effectiveStatus === "PERMIT") {
    if (evaluation) return evaluation.leaveState === "CUTI" ? "CUTI" : "IZIN";
    return getPermitDisplayLabel(attendance).toUpperCase();
  }
  if (effectiveStatus === "DAY_OFF") {
    if (evaluation?.holidayState) return "LIBUR NASIONAL";
    if (evaluation?.leaveState) return "TUKAR LIBUR";
    if (evaluation) return "HARI LIBUR";
    return getDayOffDisplayLabel(attendance).toUpperCase();
  }
  if (effectiveStatus === "ALPHA" || effectiveStatus === "ABSENT") {
    if (isHistoricalNoCheckout) return "TIDAK CHECKOUT";
    if (
      attendance.checkIn &&
      !attendance.checkOut &&
      !attendance.notes?.includes("Tanpa Keterangan") &&
      !attendance.notes?.includes("Leave")
    ) {
      return "BELUM CHECKOUT";
    }
    return "TIDAK HADIR";
  }
  if (effectiveStatus === "NO_CHECKOUT") return "TIDAK CHECKOUT";
  if (effectiveStatus === "ON_TIME") return "TEPAT WAKTU";
  if (effectiveStatus === "LATE") return "TERLAMBAT";
  return effectiveStatus;
}

function buildSummaryFromAttendances(
  attendances: AdminAttendanceRow[],
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  timezone: string,
) {
  return attendances.reduce(
    (summary, attendance) => {
      const evaluation = evaluationMap.get(
        buildAttendanceEvaluationKey(attendance, timezone),
      );
      const effectiveStatus = getEffectiveAttendanceStatus(
        attendance,
        evaluation,
      );
      summary[effectiveStatus] = (summary[effectiveStatus] ?? 0) + 1;
      return summary;
    },
    {} as Record<string, number>,
  );
}

function enrichAttendanceRow<T extends AdminAttendanceRow>(
  attendance: T,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  return {
    ...attendance,
    canonical: evaluation ?? null,
    displayStatus: getAttendanceDisplayStatus(attendance, evaluation),
  };
}

function filterAttendancesByJoinDate<
  T extends { checkIn: Date; user: { joinDate: Date | null } },
>(attendances: T[]) {
  return attendances.filter(
    (attendance) =>
      !attendance.user.joinDate ||
      attendance.checkIn >= attendance.user.joinDate,
  );
}

function buildAttendanceWhere(tenantId: string): Prisma.AttendanceWhereInput {
  return { tenantId };
}

function applyDateRangeFilter(
  where: Prisma.AttendanceWhereInput,
  input: AttendanceFilterInput,
  timezone: string,
) {
  if (input.startDate && input.endDate) {
    where.checkIn = {
      gte: toStartOfDay(input.startDate, timezone),
      lte: toEndOfDay(input.endDate, timezone),
    };
    return;
  }
  if (!input.startDate) return;
  where.checkIn = {
    gte: toStartOfDay(input.startDate, timezone),
    lte: toEndOfDay(input.startDate, timezone),
  };
}

async function syncAttendanceDependencies(
  input: AttendanceFilterInput,
  timezone: string,
  tenantId: string,
) {
  if (!input.startDate) return;
  const rangeStart = toStartOfDay(input.startDate, timezone);
  const rangeEnd = toEndOfDay(input.endDate ?? input.startDate, timezone);
  const leaveService = new LeaveService();
  const absenceService = new AbsenceService();

  await leaveService.syncApprovedLeaveToAttendanceRange(
    rangeStart,
    rangeEnd,
    tenantId,
    input.userId,
  );
  await absenceService.syncDayOffAttendanceRange(
    rangeStart,
    rangeEnd,
    tenantId,
    input.userId,
  );
}

async function resolveRestrictionScope(user: AdminAttendanceUser) {
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);
  if (isSuper)
    return {
      permissions,
      restrictedSiteId: undefined,
      restrictedDeptId: undefined,
    };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, departmentId: true },
  });
  const restrictedSiteId = permissions.includes("attendance:site_only")
    ? dbUser?.siteId || undefined
    : undefined;
  const restrictedDeptId = permissions.includes("attendance:department_only")
    ? dbUser?.departmentId || undefined
    : undefined;

  return { permissions, restrictedSiteId, restrictedDeptId };
}

function buildUserWhere(
  input: AttendanceFilterInput,
  restrictedSiteId?: string,
  restrictedDeptId?: string,
): Prisma.UserWhereInput {
  const userWhere: Prisma.UserWhereInput = {};
  if (input.userId) userWhere.id = input.userId;
  if (restrictedSiteId) userWhere.siteId = restrictedSiteId;
  else if (input.siteId) userWhere.siteId = input.siteId;
  if (restrictedDeptId) userWhere.departmentId = restrictedDeptId;
  else if (input.departmentId) userWhere.departmentId = input.departmentId;
  if (!input.search) return userWhere;
  userWhere.OR = [
    { name: { contains: input.search, mode: "insensitive" } },
    { email: { contains: input.search, mode: "insensitive" } },
  ];
  return userWhere;
}

function applyStatusFilter(
  where: Prisma.AttendanceWhereInput,
  status?: string,
  statusDetail?: string,
) {
  if (status) where.status = status as AttendanceStatus;
  if (!statusDetail || isCanonicalStatusDetail(statusDetail)) return;
  if (["ON_TIME", "LATE", "SICK"].includes(statusDetail)) {
    where.status = statusDetail as AttendanceStatus;
    return;
  }
  if (statusDetail === "ABSENT") {
    where.AND = [
      { status: { in: ["ALPHA", "ABSENT"] } },
      {
        NOT: {
          AND: [
            { status: { in: ["ALPHA", "ABSENT"] } },
            { checkOut: { not: null } },
            {
              OR: [
                { notes: { contains: "Auto checkout by system (Mangkir)" } },
                { notes: { contains: "Lupa Absen Pulang" } },
              ],
            },
          ],
        },
      },
    ];
    return;
  }
  if (statusDetail === "NO_CHECKOUT") {
    where.status = "NO_CHECKOUT" as AttendanceStatus;
  }
}

function buildIncludeUser() {
  return {
    user: {
      select: {
        name: true,
        email: true,
        image: true,
        workingHourMode: true,
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        joinDate: true,
        shift: { select: { startTime: true, endTime: true } },
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
    },
  } as const;
}

function toCsvResponse(rows: string[][]) {
  const sanitize = (value: string) =>
    /^[=+\-@]/.test(value) ? `'${value}` : value;
  const csvContent = rows
    .map((row) => row.map((cell) => `"${sanitize(cell)}"`).join(","))
    .join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": CSV_FILENAME,
    },
  });
}

function buildExportRows(
  attendances: Array<
    AdminAttendanceRow & {
      user: {
        name: string | null;
        sites?: { name: string } | null;
        departments?: { name: string } | null;
      };
    }
  >,
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  timezone: string,
) {
  const rows = [
    [
      "No",
      "Karyawan",
      "Site",
      "Departemen",
      "Tanggal",
      "Jam Masuk",
      "Jam Pulang",
      "Status",
      "Keterangan",
      "Evidence Quality",
    ],
  ];

  attendances.forEach((item, index) => {
    const evaluation = evaluationMap.get(
      buildAttendanceEvaluationKey(item, timezone),
    );
    const effectiveStatus = getEffectiveAttendanceStatus(item, evaluation);
    const displayStatus = getAttendanceDisplayStatus(item, evaluation);
    const checkInDate = new Date(item.checkIn);
    const checkOutDate = item.checkOut ? new Date(item.checkOut) : null;
    const isHistoricalNoCheckout = isHistoricalAutoCheckoutAbsence(item);
    const isAbsentOrLeave =
      ["ALPHA", "ABSENT", "SICK", "PERMIT", "DAY_OFF"].includes(
        effectiveStatus,
      ) && !isHistoricalNoCheckout;
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    };
    const checkInStr = isAbsentOrLeave
      ? "-"
      : checkInDate
          .toLocaleTimeString("id-ID", timeOptions)
          .replace(/\./g, ":");
    const checkOutStr =
      isAbsentOrLeave ||
      effectiveStatus === "NO_CHECKOUT" ||
      isHistoricalNoCheckout ||
      !checkOutDate
        ? "-"
        : checkOutDate
            .toLocaleTimeString("id-ID", timeOptions)
            .replace(/\./g, ":");

    rows.push([
      String(index + 1),
      item.user.name || "-",
      item.user.sites?.name || "-",
      item.user.departments?.name || "-",
      checkInDate.toLocaleDateString("id-ID", dateOptions),
      checkInStr,
      checkOutStr,
      displayStatus,
      item.notes || "-",
      evaluation?.evidenceQuality || "-",
    ]);
  });

  return rows;
}

export class AdminAttendanceRouteService {
  private readonly attendanceRepository: IAttendanceRepository;

  constructor(
    attendanceRepository: IAttendanceRepository = new AttendanceRepository(),
  ) {
    this.attendanceRepository = attendanceRepository;
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

    const where = buildAttendanceWhere(tenantId);
    applyDateRangeFilter(where, input, timezone);

    const { restrictedSiteId, restrictedDeptId } =
      await resolveRestrictionScope(user);
    const userWhere = buildUserWhere(input, restrictedSiteId, restrictedDeptId);
    if (Object.keys(userWhere).length > 0) where.user = userWhere;
    applyStatusFilter(where, input.status, input.statusDetail);

    const activeAttendanceWhere = {
      ...where,
      correctedAt: null,
    } as Prisma.AttendanceWhereInput;
    const includeUser = buildIncludeUser();
    const isExport = input.export === "true";
    const usesCanonicalStatusFilter = isCanonicalStatusDetail(
      input.statusDetail,
    );
    const skip = (input.page - 1) * input.limit;

    if (isExport) {
      const allAttendances = filterAttendancesByJoinDate(
        await this.attendanceRepository.findMany({
          where: activeAttendanceWhere,
          include: includeUser,
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

    if (usesCanonicalStatusFilter) {
      const allAttendances = filterAttendancesByJoinDate(
        await this.attendanceRepository.findMany({
          where,
          include: includeUser,
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
      const data = filteredAttendances
        .slice(skip, skip + input.limit)
        .map((item) =>
          enrichAttendanceRow(
            item,
            evaluationMap.get(buildAttendanceEvaluationKey(item, timezone)),
          ),
        );
      const summary = buildSummaryFromAttendances(
        filteredAttendances.filter((item) => !item.correctedAt),
        evaluationMap,
        timezone,
      );

      return {
        type: "paginated" as const,
        data,
        meta: {
          page: input.page,
          limit: input.limit,
          total: filteredAttendances.length,
          summary,
        },
      };
    }

    const [rawPaginatedData, total, statusGroups] = await Promise.all([
      this.attendanceRepository.findMany({
        where,
        include: includeUser,
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

    const summary = statusGroups.reduce(
      (acc, curr) => {
        acc[curr.status] = curr._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      type: "paginated" as const,
      data: filterAttendancesByJoinDate(rawPaginatedData).map((item) =>
        enrichAttendanceRow(item, null),
      ),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        summary,
      },
    };
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
