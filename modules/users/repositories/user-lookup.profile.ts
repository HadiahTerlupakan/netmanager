import { prisma } from "@/lib/prisma";

/** Ambil info user dasar dengan site untuk billing dan notifikasi. */
export function findByIdWithSite(id: string, tenantId?: string | null) {
  return prisma.user.findFirst({
    where: { id, tenantId },
    select: { name: true, siteId: true },
  });
}

/** Ambil konteks departemen user. */
export function findByIdWithDepartment(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });
}

/** Ambil konfigurasi kerja banyak user. */
export function findManyWithWorkConfig(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      workingHourMode: true,
      startWorkTime: true,
      endWorkTime: true,
      flexibleTargetHour: true,
      shift: { select: { startTime: true, endTime: true } },
    },
  });
}

/** Ambil info dasar banyak user. */
export function findManyWithBasicInfo(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      image: true,
      sites: { select: { name: true } },
      departments: { select: { name: true } },
    },
  });
}

/** Ambil detail user untuk report attendance dan dashboard. */
export function findManyWithFullDetails(userIds: string[], tenantId?: string) {
  return prisma.user.findMany({
    where: { id: { in: userIds }, ...(tenantId ? { tenantId } : {}) },
    select: {
      id: true,
      name: true,
      image: true,
      role: { select: { name: true } },
      sites: { select: { id: true, name: true } },
      departments: { select: { id: true, name: true } },
    },
  });
}

/** Ambil user dengan filter where kustom. */
export function findManyWithCustomWhere(
  where: Parameters<typeof prisma.user.findMany>[0]["where"],
) {
  return prisma.user.findMany({ where, select: { id: true } });
}
