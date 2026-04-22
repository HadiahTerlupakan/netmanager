import { NextResponse } from "next/server";
import { prisma } from "@/modules/database";
import { Prisma } from "@prisma/client";
import { apiPaginatedWithSummary, ApiErrors } from "@/lib/api-response";
import {
  attendanceBulkDeleteSchema,
  attendanceFilterSchema,
} from "@/lib/validations/attendance";
import { createHandler, apiSuccess } from "@/lib/api";
import { logActivitySafe } from "@/lib/logger";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import {
  getDayOffDisplayLabel,
  getPermitDisplayLabel,
  isHistoricalAutoCheckoutAbsence,
} from "@/lib/attendance-display";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { LeaveService } from "@/modules/attendance";
import { AbsenceService } from "@/modules/attendance";
import { AttendanceRepository } from "@/modules/attendance";
import * as z from "zod";

/**
 * Admin Attendance Routes
 * Fully database-driven pagination and filtering.
 */
type AttendanceEvaluationLookupRow = Awaited<
  ReturnType<AttendanceRepository["findManyEvaluationLookups"]>
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

const CANONICAL_STATUS_DETAILS = new Set([
  "CUTI",
  "IZIN",
  "TUKAR_LIBUR",
  "HARI_LIBUR",
  "HARI_OFF",
]);
const attendanceRepository = new AttendanceRepository();

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

  const evaluations = await attendanceRepository.findManyEvaluationLookups({
    tenantId,
    userIds,
    workDates,
  });

  const evaluationEntries: Array<[string, AttendanceEvaluationLookupRow]> =
    evaluations.map((evaluation: AttendanceEvaluationLookupRow) => [
      buildEvaluationLookupKey(evaluation, timezone),
      evaluation,
    ]);

  return new Map<string, AttendanceEvaluationLookupRow>(evaluationEntries);
}

function matchesCanonicalStatusDetail(
  statusDetail: string | undefined,
  evaluation?: AttendanceEvaluationLookupRow | null,
) {
  if (!statusDetail) {
    return true;
  }

  switch (statusDetail) {
    case "CUTI":
      return (
        evaluation?.finalStatus === "PERMIT" && evaluation.leaveState === "CUTI"
      );
    case "IZIN":
      return (
        evaluation?.finalStatus === "PERMIT" &&
        Boolean(evaluation.leaveState) &&
        evaluation.leaveState !== "CUTI"
      );
    case "TUKAR_LIBUR":
      return (
        evaluation?.finalStatus === "DAY_OFF" && Boolean(evaluation.leaveState)
      );
    case "HARI_LIBUR":
      return (
        evaluation?.finalStatus === "DAY_OFF" &&
        Boolean(evaluation.holidayState)
      );
    case "HARI_OFF":
      return (
        evaluation?.finalStatus === "DAY_OFF" &&
        !evaluation.holidayState &&
        !evaluation.leaveState
      );
    default:
      return true;
  }
}

function filterAttendancesByCanonicalStatusDetail<T extends AdminAttendanceRow>(
  attendances: T[],
  evaluationMap: Map<string, AttendanceEvaluationLookupRow>,
  statusDetail: string | undefined,
  timezone: string,
) {
  if (!isCanonicalStatusDetail(statusDetail)) {
    return attendances;
  }

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
    if (evaluation) {
      return evaluation.leaveState === "CUTI" ? "CUTI" : "IZIN";
    }
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

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  const timezone = await getTimezone(tenantId);

  if (!(await hasPermission("attendance:read"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const { searchParams } = req.nextUrl;
  const queryParams = Object.fromEntries(searchParams.entries());

  const parseResult = attendanceFilterSchema.safeParse(queryParams);
  if (!parseResult.success) {
    return ApiErrors.badRequest("Parameter tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const {
    page,
    limit,
    startDate: startDateStr,
    endDate: endDateStr,
    userId,
    siteId,
    departmentId,
    status,
    statusDetail,
    search,
    export: isExportStr,
  } = parseResult.data;
  const skip = (page - 1) * limit;

  const where: Prisma.AttendanceWhereInput = { tenantId };

  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  let restrictedSiteId: string | undefined;
  let restrictedDeptId: string | undefined;

  if (!isSuper) {
    if (permissions.includes("attendance:site_only")) {
      const { prisma: db } = await import("@/modules/database");
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true },
      });
      restrictedSiteId = dbUser?.siteId || undefined;
    }
    if (permissions.includes("attendance:department_only")) {
      const { prisma: db } = await import("@/modules/database");
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { departmentId: true },
      });
      restrictedDeptId = dbUser?.departmentId || undefined;
    }
  }

  let rangeStart: Date | null = null;
  let rangeEnd: Date | null = null;

  if (startDateStr && endDateStr) {
    rangeStart = toStartOfDay(startDateStr, timezone);
    rangeEnd = toEndOfDay(endDateStr, timezone);
    where.checkIn = { gte: rangeStart, lte: rangeEnd };
  } else if (startDateStr) {
    rangeStart = toStartOfDay(startDateStr, timezone);
    rangeEnd = toEndOfDay(startDateStr, timezone);
    where.checkIn = { gte: rangeStart, lte: rangeEnd };
  }

  if (rangeStart && rangeEnd) {
    const leaveService = new LeaveService();
    const absenceService = new AbsenceService();

    await leaveService.syncApprovedLeaveToAttendanceRange(
      rangeStart,
      rangeEnd,
      tenantId,
      userId,
    );
    await absenceService.syncDayOffAttendanceRange(
      rangeStart,
      rangeEnd,
      tenantId,
      userId,
    );
  }

  const userWhere: Prisma.UserWhereInput = {};
  if (userId) userWhere.id = userId;
  if (restrictedSiteId) userWhere.siteId = restrictedSiteId;
  else if (siteId) userWhere.siteId = siteId;
  if (restrictedDeptId) userWhere.departmentId = restrictedDeptId;
  else if (departmentId) userWhere.departmentId = departmentId;

  if (search) {
    userWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (Object.keys(userWhere).length > 0) where.user = userWhere;
  if (status) where.status = status;

  const usesCanonicalStatusFilter = isCanonicalStatusDetail(statusDetail);

  if (statusDetail && !usesCanonicalStatusFilter) {
    switch (statusDetail) {
      case "ON_TIME":
      case "LATE":
      case "SICK":
        where.status = statusDetail;
        break;
      case "ABSENT":
        where.AND = [
          { status: { in: ["ALPHA", "ABSENT"] } },
          {
            NOT: {
              AND: [
                { status: { in: ["ALPHA", "ABSENT"] } },
                { checkOut: { not: null } },
                {
                  OR: [
                    {
                      notes: { contains: "Auto checkout by system (Mangkir)" },
                    },
                    { notes: { contains: "Lupa Absen Pulang" } },
                  ],
                },
              ],
            },
          },
        ];
        break;
      case "NO_CHECKOUT":
        where.status = "NO_CHECKOUT";
        break;
    }
  }

  const isExport = isExportStr === "true";

  const includeUser = {
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
        shift: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
    },
  };

  const filterAttendancesByJoinDate = <
    T extends { checkIn: Date; user: { joinDate: Date | null } },
  >(
    attendances: T[],
  ) =>
    attendances.filter(
      (attendance) =>
        !attendance.user.joinDate ||
        attendance.checkIn >= attendance.user.joinDate,
    );

  const activeAttendanceWhere = {
    ...where,
    correctedAt: null,
  } as Prisma.AttendanceWhereInput;

  if (isExport) {
    const allAttendances = filterAttendancesByJoinDate(
      await prisma.attendance.findMany({
        where: activeAttendanceWhere,
        include: includeUser,
        orderBy: { checkIn: "desc" },
      }),
    );
    const evaluationMap = await getAttendanceEvaluationMap(
      allAttendances,
      tenantId,
      timezone,
    );
    const filteredAttendances = filterAttendancesByCanonicalStatusDetail(
      allAttendances,
      evaluationMap,
      statusDetail,
      timezone,
    );

    const csvRows = [
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

    filteredAttendances.forEach((item, index) => {
      const evaluation = evaluationMap.get(
        buildAttendanceEvaluationKey(item, timezone),
      );
      const effectiveStatus = getEffectiveAttendanceStatus(item, evaluation);
      const displayStatus = getAttendanceDisplayStatus(item, evaluation);
      const checkInDate = new Date(item.checkIn);
      const checkOutDate = item.checkOut ? new Date(item.checkOut) : null;
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
      const isHistoricalNoCheckout = isHistoricalAutoCheckoutAbsence(item);
      const isAbsentOrLeave =
        ["ALPHA", "ABSENT", "SICK", "PERMIT", "DAY_OFF"].includes(
          effectiveStatus,
        ) && !isHistoricalNoCheckout;

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

      csvRows.push([
        (index + 1).toString(),
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

    const sanitizeCSV = (value: string) =>
      typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value;
    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${sanitizeCSV(cell)}"`).join(","))
      .join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="absensi.csv"`,
      },
    });
  }

  if (usesCanonicalStatusFilter) {
    const allAttendances = filterAttendancesByJoinDate(
      await prisma.attendance.findMany({
        where,
        include: includeUser,
        orderBy: { checkIn: "desc" },
      }),
    );
    const evaluationMap = await getAttendanceEvaluationMap(
      allAttendances,
      tenantId,
      timezone,
    );
    const filteredAttendances = filterAttendancesByCanonicalStatusDetail(
      allAttendances,
      evaluationMap,
      statusDetail,
      timezone,
    );
    const paginatedData = filteredAttendances
      .slice(skip, skip + limit)
      .map((item) =>
        enrichAttendanceRow(
          item,
          evaluationMap.get(buildAttendanceEvaluationKey(item, timezone)),
        ),
      );
    const total = filteredAttendances.length;
    const summary = buildSummaryFromAttendances(
      filteredAttendances.filter((item) => !item.correctedAt),
      evaluationMap,
      timezone,
    );

    return apiPaginatedWithSummary(paginatedData, {
      page,
      limit,
      total,
      summary,
    });
  }

  const [rawPaginatedData, total, statusGroups] = await Promise.all([
    prisma.attendance.findMany({
      where,
      include: includeUser,
      orderBy: { checkIn: "desc" },
      skip,
      take: limit,
    }),
    prisma.attendance.count({ where }),
    prisma.attendance.groupBy({
      by: ["status"],
      where: activeAttendanceWhere,
      _count: { _all: true },
    }),
  ]);
  const paginatedData = filterAttendancesByJoinDate(rawPaginatedData);

  const summary = statusGroups.reduce(
    (acc, curr) => {
      acc[curr.status] = curr._count._all;
      return acc;
    },
    {} as Record<string, number>,
  );

  return apiPaginatedWithSummary(
    paginatedData.map((item) => enrichAttendanceRow(item, null)),
    { page, limit, total, summary },
  );
});

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user;
  const tenantId = user.tenantId;

  if (!tenantId) {
    return ApiErrors.badRequest("Tenant ID tidak ditemukan");
  }

  if (!(await hasPermission("attendance:delete"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return ApiErrors.badRequest("Data tidak valid");
  }

  const parseResult = attendanceBulkDeleteSchema.safeParse(body);

  if (!parseResult.success) {
    return ApiErrors.badRequest("Data tidak valid", {
      errors: z.flattenError(parseResult.error).fieldErrors,
    });
  }

  const attendanceWhere: Prisma.AttendanceWhereInput = {
    tenantId,
    id: { in: parseResult.data.ids },
  };

  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);

  if (!isSuper) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { siteId: true, departmentId: true },
    });
    const userScope: Prisma.UserWhereInput = {};
    const hasSiteOnlyScope = permissions.includes("attendance:site_only");
    const hasDepartmentOnlyScope = permissions.includes(
      "attendance:department_only",
    );

    if (hasSiteOnlyScope) {
      if (!dbUser?.siteId) {
        attendanceWhere.user = { id: "__NO_SCOPE_MATCH__" };
      } else {
        userScope.siteId = dbUser.siteId;
      }
    }

    if (hasDepartmentOnlyScope) {
      if (!dbUser?.departmentId) {
        attendanceWhere.user = { id: "__NO_SCOPE_MATCH__" };
      } else {
        userScope.departmentId = dbUser.departmentId;
      }
    }

    if (
      attendanceWhere.user?.id !== "__NO_SCOPE_MATCH__" &&
      Object.keys(userScope).length > 0
    ) {
      attendanceWhere.user = userScope;
    }
  }

  const deletableAttendances = await prisma.attendance.findMany({
    where: attendanceWhere,
    select: { id: true },
  });

  const deletedIds = deletableAttendances.map((attendance) => attendance.id);

  if (deletedIds.length > 0) {
    await prisma.attendance.deleteMany({
      where: {
        tenantId,
        id: { in: deletedIds },
      },
    });
  }

  logActivitySafe({
    action: "DELETE",
    subject: "Attendance",
    userId: user.id,
    details: {
      ids: deletedIds,
      requestedCount: parseResult.data.ids.length,
      deletedCount: deletedIds.length,
    },
  });

  return apiSuccess({
    requestedCount: parseResult.data.ids.length,
    deletedCount: deletedIds.length,
    deletedIds,
    skippedCount: parseResult.data.ids.length - deletedIds.length,
  });
});
