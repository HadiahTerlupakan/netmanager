import type { PrismaClient } from "@prisma/client";
import type {
  WorkOrderFilters,
  WorkOrderWithRelations,
} from "../domain/ports/IWorkOrderRepository";
import {
  buildEmployeeDepartmentPagination,
  buildEmployeeDepartmentStatsWhere,
  buildEmployeeDepartmentWhere,
  createDepartmentWorkloadSummary,
  getInProgressStatuses,
} from "./work-order-repository-dashboard-helpers";

/** Get recent work orders for dashboard widgets. */
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

/** Get department workload statistics. */
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
  const departments = await prisma.departments.findMany({
    where: departmentId ? { id: departmentId } : {},
    select: {
      id: true,
      name: true,
    },
  });

  const workload = await Promise.all(
    departments.map(async (department) => {
      const [total, pending, inProgress, completed] = await Promise.all([
        prisma.workOrders.count({ where: { departmentId: department.id } }),
        prisma.workOrders.count({
          where: { departmentId: department.id, status: "PENDING" },
        }),
        prisma.workOrders.count({
          where: {
            departmentId: department.id,
            status: { in: getInProgressStatuses() },
          },
        }),
        prisma.workOrders.count({
          where: {
            departmentId: department.id,
            status: { in: ["COMPLETED", "VERIFIED"] },
          },
        }),
      ]);

      return createDepartmentWorkloadSummary({
        departmentId: department.id,
        departmentName: department.name,
        total,
        pending,
        inProgress,
        completed,
      });
    }),
  );

  return workload.filter((department) => department.total > 0);
}

/** Get work orders visible from employee department dashboard. */
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
  const where = buildEmployeeDepartmentWhere({
    departmentId,
    employeeId,
    filters,
  });
  const pagination = buildEmployeeDepartmentPagination(page, limit);
  const statsWhere = buildEmployeeDepartmentStatsWhere(where);

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
        skip: pagination.skip,
        take: pagination.limit,
      }),
      prisma.workOrders.count({ where }),
      prisma.workOrders.count({ where: statsWhere.assigned }),
      prisma.workOrders.count({ where: statsWhere.inProgress }),
      prisma.workOrders.count({ where: statsWhere.completed }),
    ]);

  return {
    workOrders: workOrders as WorkOrderWithRelations[],
    total,
    page: pagination.page,
    totalPages: Math.ceil(total / pagination.limit),
    stats: {
      assigned,
      inProgress,
      completed,
    },
  };
}
