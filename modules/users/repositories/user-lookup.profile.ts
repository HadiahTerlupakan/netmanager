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

/**
 * Cari karyawan aktif berdasarkan nama, email, atau telepon — untuk pemilih
 * orang di formulir modul lain (mis. penanda tangan surat pengesahan).
 * Isolasi tenant ditegakkan ekstensi Prisma.
 */
export function searchActiveEmployees(search: string, limit: number) {
  const keyword = search.trim();

  return prisma.user.findMany({
    where: {
      isActive: true,
      employeeType: "KARYAWAN",
      ...(keyword
        ? {
            OR: [
              { name: { contains: keyword, mode: "insensitive" } },
              { email: { contains: keyword, mode: "insensitive" } },
              { phone: { contains: keyword } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: { select: { name: true } },
      departments: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: limit,
  });
}

/** Ambil karyawan aktif dari daftar id; dipakai memvalidasi pilihan dari klien. */
export function findActiveEmployeesByIds(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds }, isActive: true, employeeType: "KARYAWAN" },
    select: { id: true },
  });
}
