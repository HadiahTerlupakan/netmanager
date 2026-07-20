import { prisma } from "@/lib/prisma";
import { Prisma, WorkingHourMode } from "@prisma/client";

import { buildUserJoinDateFilter } from "./user-repository.helpers";

const DEFAULT_REFERENCE_DATE_FILTER = "SUPER_ADMIN";

/**
 * Ambil user beserta site geofence utama dan multi-site.
 * Note: 31 baris - sudah optimal dengan Prisma query builder untuk nested relations.
 * Memecah lebih lanjut akan memisahkan select fields yang saling terkait.
 */
export function findUserWithSites(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      userSites: {
        select: {
          site: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
              attendanceRadius: true,
              isActive: true,
            },
          },
        },
      },
      sites: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
          attendanceRadius: true,
          isActive: true,
        },
      },
    },
  });
}

/** Ambil kebijakan geofence user secara ringan. */
export async function getGeofencePolicy(
  userId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<
    Array<{ attendanceGeofencePolicy: string | null }>
  >`
    SELECT "attendanceGeofencePolicy"
    FROM "User"
    WHERE "id" = ${userId}
    LIMIT 1
  `;

  return rows[0]?.attendanceGeofencePolicy ?? null;
}

/** Ambil user aktif untuk proses attendance. */
export function findActiveForAttendance(
  tenantId: string,
  userId?: string,
  referenceDate?: Date,
) {
  return prisma.user.findMany({
    where: buildActiveAttendanceFilter(tenantId, userId, referenceDate),
    select: {
      id: true,
      name: true,
      workDays: true,
      workingHourMode: true,
      shiftId: true,
      shift: true,
    },
  });
}

function buildActiveAttendanceFilter(
  tenantId: string,
  userId?: string,
  referenceDate?: Date,
) {
  return {
    tenantId,
    isActive: true,
    isAttendanceRequired: true,
    ...(userId ? { id: userId } : {}),
    ...(referenceDate ? buildUserJoinDateFilter(referenceDate) : {}),
    role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
    workingHourMode: { not: WorkingHourMode.FLEXIBLE },
  };
}

/** Ambil user aktif yang punya push token/phone dan jadwal kerja (reminder absensi). */
export function findActiveWithPushTokenAndSchedule() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      tenantId: { not: null },
      startWorkTime: { not: null },
      OR: [{ pushToken: { not: null } }, { phone: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      tenantId: true,
      startWorkTime: true,
      endWorkTime: true,
      workDays: true,
      pushToken: true,
      phone: true,
      workingHourMode: true,
    },
  });
}

/** Ambil user flexible aktif yang punya push token/phone (belum absen harian). */
export function findActiveFlexibleWithContact() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      tenantId: { not: null },
      workingHourMode: WorkingHourMode.FLEXIBLE,
      OR: [{ pushToken: { not: null } }, { phone: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      tenantId: true,
      workDays: true,
      pushToken: true,
      phone: true,
      flexibleTargetHour: true,
    },
  });
}

/** Ambil user fixed-hour untuk auto alpha. */
export function findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
  return prisma.user.findMany({
    where: buildFixedHourAutoAlphaFilter(referenceDate),
    select: {
      id: true,
      name: true,
      tenantId: true,
      endWorkTime: true,
      workDays: true,
      workingHourMode: true,
      isAttendanceRequired: true,
      joinDate: true,
    },
  });
}

function buildFixedHourAutoAlphaFilter(
  referenceDate?: Date,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    isAttendanceRequired: true,
    tenantId: { not: null },
    endWorkTime: { not: null },
    ...(referenceDate ? buildUserJoinDateFilter(referenceDate) : {}),
    workingHourMode: WorkingHourMode.FIXED,
    role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
  };
}

/** Ambil jadwal kerja user yang dibatasi tenant. */
export function findWorkScheduleByIdWithTenant(
  userId: string,
  tenantId: string,
) {
  return prisma.user.findUnique({
    where: { id: userId, tenantId },
    select: { workingHourMode: true, workDays: true },
  });
}

/** Ambil jadwal kerja dasar user. */
export function findWorkScheduleById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { workDays: true, workingHourMode: true },
  });
}

/** Ambil pengaturan attendance user. */
export function findAttendanceSettingsById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      startWorkTime: true,
      endWorkTime: true,
      workingHourMode: true,
      attendanceGeofencePolicy: true,
      shiftId: true,
      joinDate: true,
      shift: { select: { startTime: true, endTime: true } },
    },
  });
}

/** Ambil site user untuk validasi attendance. */
export function findWithSitesById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      sites: {
        select: {
          name: true,
          latitude: true,
          longitude: true,
          attendanceRadius: true,
        },
      },
    },
  });
}
