import type { Prisma } from "@prisma/client";
import type { WorkOrderFilters } from "../domain/ports/IWorkOrderRepository";

const DEFAULT_EMPLOYEE_WORK_ORDER_PAGE = 1;
const DEFAULT_EMPLOYEE_WORK_ORDER_LIMIT = 20;
const COMPLETED_STATUSES = ["COMPLETED", "VERIFIED"] as const;
const IN_PROGRESS_STATUSES = ["ASSIGNED", "IN_PROGRESS"] as const;

type EmployeeDepartmentParams = {
  departmentId: string;
  employeeId: string;
  filters?: WorkOrderFilters;
  page?: number;
  limit?: number;
};

/** Build where clause for employee department work order query. */
export function buildEmployeeDepartmentWhere(
  params: EmployeeDepartmentParams,
): Prisma.WorkOrdersWhereInput {
  const { departmentId, employeeId, filters } = params;
  const where: Prisma.WorkOrdersWhereInput = {
    OR: [
      { departmentId },
      { assignedToId: employeeId },
      { assignments: { some: { userId: employeeId } } },
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

  return where;
}

/** Build stats count filters for employee department dashboard. */
export function buildEmployeeDepartmentStatsWhere(
  where: Prisma.WorkOrdersWhereInput,
) {
  return {
    assigned: { ...where, status: "ASSIGNED" as const },
    inProgress: { ...where, status: "IN_PROGRESS" as const },
    completed: { ...where, status: { in: [...COMPLETED_STATUSES] } },
  };
}

/** Build pagination values for employee department work order query. */
export function buildEmployeeDepartmentPagination(
  page = DEFAULT_EMPLOYEE_WORK_ORDER_PAGE,
  limit = DEFAULT_EMPLOYEE_WORK_ORDER_LIMIT,
) {
  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/** Build completion summary payload for department workload rows. */
export function createDepartmentWorkloadSummary(params: {
  departmentId: string;
  departmentName: string;
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}) {
  return params;
}

/** Return statuses treated as in progress for workload stats. */
export function getInProgressStatuses() {
  return [...IN_PROGRESS_STATUSES];
}
