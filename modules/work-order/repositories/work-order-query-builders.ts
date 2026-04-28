import { Prisma, type WorkOrderStatus } from "@prisma/client";
import type { WorkOrderFilters } from "./IWorkOrderRepository";

const FINALIZED_UNASSIGNED_STATUSES: WorkOrderStatus[] = [
  "CANCELLED",
  "CLOSED",
  "COMPLETED",
  "VERIFIED",
];

/** Terapkan filter status work order. */
export function applyWorkOrderStatusFilter(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.status) {
    return;
  }

  where.status = Array.isArray(filters.status)
    ? { in: filters.status }
    : filters.status;
}

/** Terapkan filter prioritas work order. */
export function applyWorkOrderPriorityFilter(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.priority) {
    return;
  }

  where.priority = Array.isArray(filters.priority)
    ? { in: filters.priority }
    : filters.priority;
}

/** Terapkan filter tipe work order. */
export function applyWorkOrderTypeFilter(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.type) {
    return;
  }

  where.type = Array.isArray(filters.type)
    ? { in: filters.type }
    : filters.type;
}

/** Terapkan filter relasi dasar work order. */
export function applyWorkOrderRelationFilters(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters) {
    return;
  }

  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }

  if (filters.pelangganId) {
    where.pelangganId = filters.pelangganId;
  }

  if (filters.siteId) {
    where.siteId = filters.siteId;
  }

  if (filters.isInternal === true) {
    where.isInternal = true;
  } else if (filters.isInternal === false) {
    where.isInternal = false;
  }
}

/** Terapkan filter tanggal work order. */
export function applyWorkOrderDateFilters(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters) {
    return;
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  if (filters.scheduledDateFrom || filters.scheduledDateTo) {
    const scheduledDateFilter: Prisma.DateTimeNullableFilter = {};
    if (filters.scheduledDateFrom) {
      scheduledDateFilter.gte = filters.scheduledDateFrom;
    }
    if (filters.scheduledDateTo) {
      scheduledDateFilter.lte = filters.scheduledDateTo;
    }
    where.scheduledDate = scheduledDateFilter;
  }
}

/** Terapkan filter work order unassigned. */
export function applyWorkOrderUnassignedFilter(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.unassignedOnly) {
    return;
  }

  where.assignedToId = null;
  where.assignedMitraId = null;

  if (where.status === undefined) {
    where.status = { notIn: FINALIZED_UNASSIGNED_STATUSES };
    return;
  }

  const currentStatus = where.status;
  where.AND = [
    ...normalizeAndConditions(where.AND),
    { status: currentStatus as Prisma.WorkOrdersWhereInput["status"] },
    { status: { notIn: FINALIZED_UNASSIGNED_STATUSES } },
  ];
  delete where.status;
}

/** Terapkan filter user yang terlibat pada work order. */
export function applyWorkOrderUserFilters(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.involvedUserId) {
    if (filters?.assignedToId !== undefined) {
      where.assignedToId = filters.assignedToId;
    }
    return;
  }

  const userFilter: Prisma.WorkOrdersWhereInput = {
    OR: [
      { assignedToId: filters.involvedUserId },
      { assignedMitraId: filters.involvedUserId },
      {
        assignments: {
          some: {
            userId: filters.involvedUserId,
            status: { not: "REJECTED" },
          },
        },
      },
      {
        assignments: {
          some: {
            mitraId: filters.involvedUserId,
            status: { not: "REJECTED" },
          },
        },
      },
    ],
  };

  if (where.OR) {
    where.AND = [
      ...normalizeAndConditions(where.AND),
      { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
      userFilter,
    ];
    delete where.OR;
    return;
  }

  where.OR = userFilter.OR;
}

/** Terapkan filter pencarian teks work order. */
export function applyWorkOrderSearchFilter(
  where: Prisma.WorkOrdersWhereInput,
  filters?: WorkOrderFilters,
): void {
  if (!filters?.search) {
    return;
  }

  const searchFilter: Prisma.WorkOrdersWhereInput = {
    OR: [
      {
        workOrderNumber: {
          contains: filters.search,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
      {
        title: {
          contains: filters.search,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
      {
        description: {
          contains: filters.search,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
      {
        pelanggan: {
          nama: {
            contains: filters.search,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
      },
      {
        site: {
          name: {
            contains: filters.search,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
      },
      {
        assignedTo: {
          name: {
            contains: filters.search,
            mode: "insensitive" as Prisma.QueryMode,
          },
        },
      },
      {
        contactName: {
          contains: filters.search,
          mode: "insensitive" as Prisma.QueryMode,
        },
      },
    ],
  };

  if (where.OR) {
    where.AND = [
      ...normalizeAndConditions(where.AND),
      { OR: where.OR as Prisma.WorkOrdersWhereInput[] },
      searchFilter,
    ];
    delete where.OR;
    return;
  }

  where.OR = searchFilter.OR;
}

/** Bangun where query daftar work order dari filter. */
export function buildWorkOrderWhere(input: {
  tenantWhere: Prisma.WorkOrdersWhereInput;
  filters?: WorkOrderFilters;
}): Prisma.WorkOrdersWhereInput {
  const where: Prisma.WorkOrdersWhereInput = { ...input.tenantWhere };

  applyWorkOrderStatusFilter(where, input.filters);
  applyWorkOrderPriorityFilter(where, input.filters);
  applyWorkOrderTypeFilter(where, input.filters);
  applyWorkOrderRelationFilters(where, input.filters);
  applyWorkOrderUnassignedFilter(where, input.filters);
  applyWorkOrderUserFilters(where, input.filters);
  applyWorkOrderSearchFilter(where, input.filters);
  applyWorkOrderDateFilters(where, input.filters);

  return where;
}

function normalizeAndConditions(
  currentAnd:
    | Prisma.WorkOrdersWhereInput
    | Prisma.WorkOrdersWhereInput[]
    | undefined,
): Prisma.WorkOrdersWhereInput[] {
  if (Array.isArray(currentAnd)) {
    return currentAnd;
  }

  return currentAnd ? [currentAnd] : [];
}
