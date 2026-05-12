import { Prisma } from "@prisma/client";

import type { FindUsersParams } from "../domain/ports/IUserRepository";

export const USER_NOTIFICATION_ADMIN_SELECT = {
  id: true,
  phone: true,
} as const;

export const USER_BASE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  image: true,
  departmentId: true,
  siteId: true,
  roleId: true,
  isActive: true,
  isSales: true,
  isAttendanceRequired: true,
  workingHourMode: true,
  attendanceGeofencePolicy: true,
  startWorkTime: true,
  endWorkTime: true,
  workDays: true,
  flexibleTargetHour: true,
  shiftId: true,
  canvasingTarget: true,
  targetSchema: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const USER_DETAIL_SELECT = {
  ...USER_BASE_SELECT,
  passwordHash: true,
  emailVerified: true,
  pushToken: true,
  pushTokenUpdatedAt: true,
  tokenVersion: true,
  lastVersionCode: true,
  lastVersionName: true,
  lastVersionUpdate: true,
  lastLoginAt: true,
  bankName: true,
  bankAccountNo: true,
  bankAccountName: true,
  bpjsKesehatan: true,
  bpjsKetenagakerjaan: true,
  fcmTokens: true,
  joinDate: true,
  ptkpStatus: true,
  employeeType: true,
  basicSalary: true,
  payPeriodDay: true,
  payDay: true,
  woIncentiveEnabled: true,
  woIncentiveRate: true,
  lateDeductionRate: true,
  absentDeductionRate: true,
  overtimeRateNormal: true,
  overtimeRateHoliday: true,
  overtimeRateNational: true,
  overtimeCalcTypeNormal: true,
  overtimeCalcTypeHoliday: true,
  overtimeCalcTypeNational: true,
  departments: { select: { id: true, name: true } },
  sites: { select: { id: true, code: true, name: true } },
  role: { select: { id: true, name: true } },
  tenant: { select: { id: true, name: true } },
  userSites: {
    select: {
      id: true,
      siteId: true,
      isPrimary: true,
      site: { select: { id: true, code: true, name: true } },
    },
    orderBy: { isPrimary: "desc" },
  },
  shift: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

/** Bangun query list user admin dengan filter dan pagination. */
export function buildUserFindAllQuery(
  params: FindUsersParams,
): Prisma.UserFindManyArgs {
  const query: Prisma.UserFindManyArgs = {
    orderBy: { createdAt: "desc" },
    include: {
      departments: { select: { id: true, name: true } },
      sites: { select: { id: true, code: true, name: true } },
      role: { select: { id: true, name: true } },
      userSites: {
        select: {
          id: true,
          siteId: true,
          isPrimary: true,
          site: { select: { id: true, code: true, name: true } },
        },
        orderBy: { isPrimary: "desc" },
      },
    },
  };
  const where = buildUserFindAllWhere(params);

  if (Object.keys(where).length > 0) {
    query.where = where;
  }

  if (params.page && params.limit) {
    query.skip = (params.page - 1) * params.limit;
    query.take = params.limit;
  }

  return query;
}

/** Bangun filter joinDate untuk query user aktif berdasarkan tanggal acuan. */
export function buildUserJoinDateFilter(
  referenceDate: Date,
): Prisma.UserWhereInput {
  return {
    OR: [{ joinDate: null }, { joinDate: { lte: referenceDate } }],
  };
}

/** Bangun filter notifikasi approval admin berdasarkan tenant dan site user. */
export function buildUserNotificationWhere(
  tenantId: string | null | undefined,
  userSiteId: string | null | undefined,
): Prisma.UserWhereInput {
  return {
    tenantId,
    OR: [
      { role: { isSuperAdmin: true } },
      {
        AND: [
          { role: { canReceiveWhatsappApproval: true } },
          ...buildNotificationSiteScope(userSiteId),
        ],
      },
    ],
  };
}

function buildUserFindAllWhere(params: FindUsersParams): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (params.siteId) {
    where.AND = [
      {
        OR: [
          { siteId: params.siteId },
          { userSites: { some: { siteId: params.siteId } } },
        ],
      },
    ];
  }

  if (params.tenantId) {
    where.tenantId = params.tenantId;
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.roleName) {
    where.role = {
      is: { name: { equals: params.roleName, mode: "insensitive" } },
    };
  }

  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: "insensitive" } },
      { name: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search, mode: "insensitive" } },
      {
        departments: {
          is: { name: { contains: params.search, mode: "insensitive" } },
        },
      },
    ];
  }

  return where;
}

function buildNotificationSiteScope(
  userSiteId: string | null | undefined,
): Prisma.UserWhereInput[] {
  if (!userSiteId) {
    return [];
  }

  return [
    {
      OR: [
        { siteId: userSiteId },
        { siteId: null },
        { userSites: { some: { siteId: userSiteId } } },
      ],
    },
  ];
}
