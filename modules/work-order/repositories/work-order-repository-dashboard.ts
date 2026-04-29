import type { PrismaClient } from "@prisma/client";
import type {
  WorkOrderFilters,
  WorkOrderWithRelations,
} from "./IWorkOrderRepository";

export async function getRecentWorkOrders(
  prisma: PrismaClient,
  limit: number = 5,
  filters?: WorkOrderFilters,
): Promise<WorkOrderWithRelations[]> {
  const where: Record<string, unknown> = {};
  if (filters?.departmentId) where.departmentId = filters.departmentId;
  if (filters?.assignedToId !== undefined)
    where.assignedToId = filters.assignedToId;
  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }
  return prisma.workOrders.findMany({
    where,
    include: {
      pelanggan: {
        select: {
          id: true,
          idPelanggan: true,
          nama: true,
          email: true,
          noTelp: true,
        },
      },
      site: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      department: {
        select: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: true,
      assignments: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      updates: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      attachments: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  }) as Promise<WorkOrderWithRelations[]>;
}
/**
 * Get department workload statistics
 */
export async function getDepartmentWorkload(
  prisma: PrismaClient,
  departmentId?: string,
): Promise<
  Array<{
    departmentId: string | null;
    departmentName: string;
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  }>
> {
  const where: Record<string, unknown> = {};
  if (departmentId) {
    where.id = departmentId;
  }
  const departments = await prisma.departments.findMany({
    where,
    select: {
      id: true,
      name: true,
    },
  });
  const workload = await Promise.all(
    departments.map(async (dept) => {
      const [total, pending, inProgress, completed] = await Promise.all([
        prisma.workOrders.count({
          where: { departmentId: dept.id },
        }),
        prisma.workOrders.count({
          where: { departmentId: dept.id, status: "PENDING" },
        }),
        prisma.workOrders.count({
          where: {
            departmentId: dept.id,
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
        }),
        prisma.workOrders.count({
          where: {
            departmentId: dept.id,
            status: { in: ["COMPLETED", "VERIFIED"] },
          },
        }),
      ]);
      return {
        departmentId: dept.id,
        departmentName: dept.name,
        total,
        pending,
        inProgress,
        completed,
      };
    }),
  );
  // Filter out departments with no work orders
  return workload.filter((dept) => dept.total > 0);
}
/**
 * Get work orders for employee's department
 */
export async function getEmployeeDepartmentWorkOrders(
  prisma: PrismaClient,
  departmentId: string,
  employeeId: string,
  filters?: WorkOrderFilters,
  page: number = 1,
  limit: number = 20,
): Promise<{
  workOrders: WorkOrderWithRelations[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    assigned: number;
    inProgress: number;
    completed: number;
  };
}> {
  const where: Record<string, unknown> = {
    OR: [
      { departmentId },
      { assignedToId: employeeId },
      {
        assignments: {
          some: {
            employeeId,
          },
        },
      },
    ],
  };
  if (filters?.status) {
    where.status = Array.isArray(filters.status)
      ? { in: filters.status }
      : filters.status;
  }
  if (filters?.search) {
    where.AND = [
      {
        OR: [
          {
            workOrderNumber: {
              contains: filters.search,
              mode: "insensitive",
            },
          },
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
        ],
      },
    ];
  }
  const [workOrders, total, assigned, inProgress, completed] =
    await Promise.all([
      prisma.workOrders.findMany({
        where,
        include: {
          pelanggan: {
            select: {
              id: true,
              idPelanggan: true,
              nama: true,
              noTelp: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
          tasks: true,
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          updates: true,
          attachments: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workOrders.count({ where }),
      prisma.workOrders.count({
        where: {
          ...where,
          status: "ASSIGNED",
        },
      }),
      prisma.workOrders.count({
        where: {
          ...where,
          status: "IN_PROGRESS",
        },
      }),
      prisma.workOrders.count({
        where: {
          ...where,
          status: { in: ["COMPLETED", "VERIFIED"] },
        },
      }),
    ]);
  return {
    workOrders: workOrders as WorkOrderWithRelations[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
    stats: {
      assigned,
      inProgress,
      completed,
    },
  };
}
