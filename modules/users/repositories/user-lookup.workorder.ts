import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const WORKORDER_RESOURCE = "workorders";
const WORKORDER_ACTION_READ = "read";
const WORKORDER_ACTION_SITE_ONLY = "site_only";

/**
 * Ambil user dan relasi detail untuk target notifikasi work-order.
 * Note: 24 baris - sudah optimal dengan Prisma query builder untuk nested relations.
 * Memecah lebih lanjut akan memisahkan select fields yang saling terkait.
 */
export function findManyWithDetailedRelations(where: Prisma.UserWhereInput) {
  return prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      departmentId: true,
      siteId: true,
      userSites: { select: { siteId: true } },
      role: {
        select: {
          name: true,
          permission: {
            where: {
              resource: WORKORDER_RESOURCE,
              action: WORKORDER_ACTION_SITE_ONLY,
            },
            select: { id: true },
          },
        },
      },
    },
  });
}

/** Ambil id user aktif yang berhak membaca work-order. */
export function findManyByDepartmentAndSite(
  departmentId?: string,
  siteId?: string,
  excludeUserId?: string,
) {
  return prisma.user.findMany({
    where: {
      isActive: true,
      role: {
        permission: {
          some: { resource: WORKORDER_RESOURCE, action: WORKORDER_ACTION_READ },
        },
      },
      ...(departmentId ? { departmentId } : {}),
      ...(siteId ? { siteId } : {}),
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
}
