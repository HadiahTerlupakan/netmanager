import type { Prisma, AttendanceStatus } from "@prisma/client";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";
import { isCanonicalStatusDetail } from "./AdminAttendanceEvaluationHelper";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

/** Filter attendance yang tanggalnya sebelum join date user. */
export function filterAttendancesByJoinDate<
  T extends { checkIn: Date; user: { joinDate: Date | null } },
>(attendances: T[]) {
  return attendances.filter(
    (attendance) =>
      !attendance.user.joinDate ||
      attendance.checkIn >= attendance.user.joinDate,
  );
}

/** Bangun where Prisma attendance dari input admin. */
export async function buildAdminAttendanceWhere(
  user: AdminAttendanceUser,
  input: AttendanceFilterInput,
  timezone: string,
) {
  const where: Prisma.AttendanceWhereInput = { tenantId: user.tenantId };
  applyDateRangeFilter(where, input, timezone);
  const { restrictedSiteId, restrictedDeptId } =
    await resolveRestrictionScope(user);
  const userWhere = buildUserWhere(input, restrictedSiteId, restrictedDeptId);
  if (Object.keys(userWhere).length > 0) where.user = userWhere;
  applyStatusFilter(where, input.status, input.statusDetail);
  return where;
}

/** Bangun include user standar untuk query admin attendance. */
export function buildIncludeUser() {
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

async function resolveRestrictionScope(user: AdminAttendanceUser) {
  const permissions = await getUserPermissions(user.id);
  const isSuper = isSuperAdmin(user);
  if (isSuper) {
    return {
      permissions,
      restrictedSiteId: undefined,
      restrictedDeptId: undefined,
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, departmentId: true },
  });
  return {
    permissions,
    restrictedSiteId: permissions.includes("attendance:site_only")
      ? dbUser?.siteId || undefined
      : undefined,
    restrictedDeptId: permissions.includes("attendance:department_only")
      ? dbUser?.departmentId || undefined
      : undefined,
  };
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
  if (statusDetail === "NO_CHECKOUT")
    where.status = "NO_CHECKOUT" as AttendanceStatus;
}
