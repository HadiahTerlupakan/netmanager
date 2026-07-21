import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const WORKORDER_RESOURCE = "workorders";
const WORKORDER_ACTION_READ = "read";
const WORKORDER_RESOURCES = ["workorders", "m_work_order"] as const;

/**
 * Ambil user dan relasi detail untuk target notifikasi work-order.
 * Permission WO (workorders + m_work_order) dimuat penuh agar filter
 * department_only / verify bisa dihitung di layer notification.
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
              resource: { in: [...WORKORDER_RESOURCES] },
            },
            select: { id: true, resource: true, action: true },
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
