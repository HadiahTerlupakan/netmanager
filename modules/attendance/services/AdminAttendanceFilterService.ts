import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "../types/attendance.enums";
import { getUserPermissions, isSuperAdmin } from "@/lib/auth";
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";
import { isCanonicalStatusDetail } from "./AdminAttendanceEvaluationHelper";
import type {
  AdminAttendanceUser,
  AttendanceFilterInput,
} from "./AdminAttendanceTypes";

const DIRECT_STATUS_DETAILS = ["ON_TIME", "LATE", "SICK"] as const;
const ABSENT_STATUS_VALUES: AttendanceStatus[] = ["ALPHA", "ABSENT"];
const NO_CHECKOUT_STATUS = "NO_CHECKOUT" as AttendanceStatus;
const AUTO_CHECKOUT_NOTES = [
  "Auto checkout by system (Mangkir)",
  "Lupa Absen Pulang",
] as const;

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

  const restrictionScope = await resolveRestrictionScope(user);
  const userWhere = buildUserWhere(
    input,
    restrictionScope.restrictedSiteId,
    restrictionScope.restrictedDeptId,
  );
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
  if (isSuperAdmin(user)) return createEmptyRestrictionScope();

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { siteId: true, departmentId: true },
  });

  return {
    restrictedSiteId: permissions.includes("attendance:site_only")
      ? dbUser?.siteId || undefined
      : undefined,
    restrictedDeptId: permissions.includes("attendance:department_only")
      ? dbUser?.departmentId || undefined
      : undefined,
  };
}

function createEmptyRestrictionScope(): {
  restrictedSiteId?: string;
  restrictedDeptId?: string;
} {
  return {
    restrictedSiteId: undefined,
    restrictedDeptId: undefined,
  };
}

function buildUserWhere(
  input: AttendanceFilterInput,
  restrictedSiteId?: string,
  restrictedDeptId?: string,
): Prisma.UserWhereInput {
  const userWhere: Prisma.UserWhereInput = {};
  applyUserIdentityFilter(userWhere, input);
  applyUserScopeFilter(userWhere, input, restrictedSiteId, restrictedDeptId);
  applyUserSearchFilter(userWhere, input.search);
  return userWhere;
}

function applyUserIdentityFilter(
  userWhere: Prisma.UserWhereInput,
  input: AttendanceFilterInput,
) {
  if (input.userId) userWhere.id = input.userId;
}

function applyUserScopeFilter(
  userWhere: Prisma.UserWhereInput,
  input: AttendanceFilterInput,
  restrictedSiteId?: string,
  restrictedDeptId?: string,
) {
  userWhere.siteId = restrictedSiteId || input.siteId;
  userWhere.departmentId = restrictedDeptId || input.departmentId;
}

function applyUserSearchFilter(
  userWhere: Prisma.UserWhereInput,
  search?: string,
) {
  if (!search) return;
  userWhere.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
  ];
}

function applyStatusFilter(
  where: Prisma.AttendanceWhereInput,
  status?: string,
  statusDetail?: string,
) {
  if (status) where.status = status as AttendanceStatus;
  if (!statusDetail || isCanonicalStatusDetail(statusDetail)) return;
  if (isDirectStatusDetail(statusDetail)) {
    where.status = statusDetail as AttendanceStatus;
    return;
  }
  if (statusDetail === "ABSENT") {
    where.AND = createAbsentFilter();
    return;
  }
  if (statusDetail === "NO_CHECKOUT") {
    where.status = NO_CHECKOUT_STATUS;
  }
}

function isDirectStatusDetail(
  statusDetail: string,
): statusDetail is (typeof DIRECT_STATUS_DETAILS)[number] {
  return DIRECT_STATUS_DETAILS.includes(
    statusDetail as (typeof DIRECT_STATUS_DETAILS)[number],
  );
}

function createAbsentFilter(): Prisma.AttendanceWhereInput[] {
  return [
    { status: { in: ABSENT_STATUS_VALUES } },
    {
      NOT: {
        AND: [
          { status: { in: ABSENT_STATUS_VALUES } },
          { checkOut: { not: null } },
          {
            OR: AUTO_CHECKOUT_NOTES.map((note) => ({
              notes: { contains: note },
            })),
          },
        ],
      },
    },
  ];
}
