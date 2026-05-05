import { prisma } from "@/lib/prisma";

import { buildUserJoinDateFilter } from "./user-repository.helpers";

const DEFAULT_REFERENCE_DATE_FILTER = "SUPER_ADMIN";

/** Ambil user beserta site geofence utama dan multi-site. */
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
    where: {
      tenantId,
      isActive: true,
      isAttendanceRequired: true,
      ...(userId ? { id: userId } : {}),
      ...(referenceDate ? buildUserJoinDateFilter(referenceDate) : {}),
      role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
      workingHourMode: { not: "FLEXIBLE" },
    },
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

/** Ambil user aktif yang punya push token dan jadwal kerja. */
export function findActiveWithPushTokenAndSchedule() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      pushToken: { not: null },
      startWorkTime: { not: null },
    },
    select: {
      id: true,
      name: true,
      startWorkTime: true,
      endWorkTime: true,
      workDays: true,
      pushToken: true,
    },
  });
}

/** Ambil user fixed-hour untuk auto alpha. */
export function findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      isAttendanceRequired: true,
      tenantId: { not: null },
      endWorkTime: { not: null },
      ...(referenceDate ? buildUserJoinDateFilter(referenceDate) : {}),
      workingHourMode: "FIXED",
      role: { name: { not: DEFAULT_REFERENCE_DATE_FILTER } },
    },
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
