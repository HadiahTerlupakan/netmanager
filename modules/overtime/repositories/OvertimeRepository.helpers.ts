import { OvertimeStatus, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import type {
  OvertimeCreateInput,
  OvertimeQueryFilters,
  OvertimeSiteFilter,
  OvertimeStatusCountFilters,
  OvertimeUpdateInput,
} from "../domain/ports/IOvertimeRepository";

// Lembur hanya boleh 1x per hari (pengajuan→approval→checkin→checkout = 1 siklus penuh).
// COMPLETED termasuk karena setelah selesai, user tidak boleh ajukan lagi di hari yang sama.
export const ACTIVE_OVERTIME_STATUSES: OvertimeStatus[] = [
  OvertimeStatus.PENDING,
  OvertimeStatus.APPROVED,
  OvertimeStatus.IN_PROGRESS,
  OvertimeStatus.COMPLETED,
];

/**
 * Lembur yang dihitung laporan: hanya sesi yang selesai (punya durasi), sama
 * dengan penggajian (`OvertimePayrollBridge`). PENDING/REJECTED adalah
 * pengajuan, APPROVED/IN_PROGRESS belum punya durasi.
 */
export const REPORTED_OVERTIME_STATUS = OvertimeStatus.COMPLETED;

export const OVERTIME_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      workDays: true,
      workingHourMode: true,
      siteId: true,
      departmentId: true,
      sites: { select: { name: true } },
      departments: { select: { name: true } },
    },
  },
  attendance: true,
} satisfies Prisma.OvertimeInclude;

export function buildOvertimeWhere(
  filters?: OvertimeQueryFilters,
): Prisma.OvertimeWhereInput {
  const where: Prisma.OvertimeWhereInput = { tenantId: filters?.tenantId };

  if (filters?.userId) {
    where.userId = filters.userId;
  }
  if (filters?.status !== undefined) {
    where.status = filters.status as OvertimeStatus;
  }

  applyCreatedAtRange(where, filters?.startDate, filters?.endDate);

  if (filters?.siteId || filters?.departmentId) {
    where.user = buildUserScopeFilter(filters.siteId, filters.departmentId);
  }
  if (filters?.holidayType) {
    applyHolidayFilter(where, filters.holidayType);
  }

  return where;
}

export function buildStatusCountWhere(
  filters?: OvertimeStatusCountFilters,
): Prisma.OvertimeWhereInput {
  const where: Prisma.OvertimeWhereInput = { tenantId: filters?.tenantId };

  if (filters?.userId) {
    where.userId = filters.userId;
  }

  applyCreatedAtRange(where, filters?.startDate, filters?.endDate);

  if (filters?.siteId || filters?.departmentId) {
    where.user = buildUserScopeFilter(filters.siteId, filters.departmentId);
  }

  return where;
}

/**
 * Filter lembur untuk laporan: sesi COMPLETED yang dimulai dalam rentang
 * (dasar tanggal = `startTime`, sama dengan penggajian), dibatasi lingkup
 * site/departemen pegawai. Dulu laporan memakai `createdAt` dan ikut menghitung
 * pengajuan yang masih menunggu atau ditolak.
 */
export function buildReportedOvertimeWhere(input: {
  startDate: Date;
  endDate: Date;
  siteId?: OvertimeSiteFilter;
  departmentId?: string;
  tenantId?: string;
}): Prisma.OvertimeWhereInput {
  const where: Prisma.OvertimeWhereInput = {
    status: REPORTED_OVERTIME_STATUS,
    startTime: { gte: input.startDate, lte: input.endDate },
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
  };

  if (input.siteId || input.departmentId) {
    where.user = buildUserScopeFilter(input.siteId, input.departmentId);
  }

  return where;
}

export function toCreateData(
  data: OvertimeCreateInput,
): Prisma.OvertimeUncheckedCreateInput {
  return {
    id: randomUUID(),
    userId: data.userId,
    reason: data.reason,
    status: data.status as OvertimeStatus,
    updatedAt: new Date(),
    tenantId: data.tenantId ?? null,
  };
}

export function toUpdateData(
  data: OvertimeUpdateInput,
): Prisma.OvertimeUpdateInput {
  return {
    updatedAt: new Date(),
    ...(data.status !== undefined && { status: data.status as OvertimeStatus }),
    ...(data.startTime !== undefined && { startTime: data.startTime }),
    ...(data.startPhoto !== undefined && { startPhoto: data.startPhoto }),
    ...(data.startLocation !== undefined && {
      startLocation: data.startLocation,
    }),
    ...(data.endTime !== undefined && { endTime: data.endTime }),
    ...(data.endPhoto !== undefined && { endPhoto: data.endPhoto }),
    ...(data.endLocation !== undefined && { endLocation: data.endLocation }),
    ...(data.duration !== undefined && { duration: data.duration }),
    ...(data.approvedBy !== undefined && { approvedBy: data.approvedBy }),
    ...(data.rejectionReason !== undefined && {
      rejectionReason: data.rejectionReason,
    }),
    ...(data.attendanceId !== undefined && {
      attendance: data.attendanceId
        ? { connect: { id: data.attendanceId } }
        : { disconnect: true },
    }),
    ...(data.isHolidayOvertime !== undefined && {
      isHolidayOvertime: data.isHolidayOvertime,
    }),
    ...(data.isNationalHoliday !== undefined && {
      isNationalHoliday: data.isNationalHoliday,
    }),
    ...(data.isOffDay !== undefined && { isOffDay: data.isOffDay }),
    ...(data.holidayDescription !== undefined && {
      holidayDescription: data.holidayDescription,
    }),
    ...(data.reason !== undefined && { reason: data.reason }),
  };
}

function buildUserScopeFilter(
  siteId?: OvertimeSiteFilter,
  departmentId?: string,
): Prisma.UserWhereInput {
  return {
    ...(siteId && { siteId }),
    ...(departmentId && { departmentId }),
  };
}

function applyHolidayFilter(
  where: Prisma.OvertimeWhereInput,
  holidayType: string,
): void {
  switch (holidayType) {
    case "REGULAR":
      where.isHolidayOvertime = false;
      return;
    case "NATIONAL":
      where.isNationalHoliday = true;
      return;
    case "OFFDAY":
      where.isOffDay = true;
      return;
    case "ALL_HOLIDAY":
      where.isHolidayOvertime = true;
      return;
    case "COLLECTIVE":
      where.AND = [
        { isHolidayOvertime: true },
        { isNationalHoliday: false },
        { isOffDay: false },
      ];
      return;
    default:
      return;
  }
}

function applyCreatedAtRange(
  where: Prisma.OvertimeWhereInput,
  startDate?: Date,
  endDate?: Date,
): void {
  if (!startDate || !endDate) {
    return;
  }

  where.createdAt = { gte: startDate, lte: endDate };
}
