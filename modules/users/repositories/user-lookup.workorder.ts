import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

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
