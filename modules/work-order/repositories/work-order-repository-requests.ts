import type { PrismaClient, WorkOrders } from "@prisma/client";
import type { WorkOrderWithRelations } from "./IWorkOrderRepository";

interface RequestFilterInput {
  departmentId?: string;
  siteId?: string;
  search?: string;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Ambil daftar work order request dengan filter ringkas. */
export async function findRequestedWorkOrders(
  prisma: PrismaClient,
  filters?: RequestFilterInput,
  page: number = DEFAULT_PAGE,
  limit: number = DEFAULT_LIMIT,
): Promise<{
  workOrders: WorkOrderWithRelations[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const where = buildRequestWhere(filters);
  const [workOrders, total] = await Promise.all([
    prisma.workOrders.findMany({
      where,
      include: {
        site: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.workOrders.count({ where }),
  ]);
  return {
    workOrders: workOrders as WorkOrderWithRelations[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/** Setujui work order request dan ubah statusnya ke PENDING. */
export async function approveRequestedWorkOrder(
  prisma: PrismaClient,
  id: string,
  approvedById: string,
): Promise<WorkOrders> {
  return prisma.workOrders.update({
    where: { id },
    data: {
      status: "PENDING",
      approvedById,
      approvedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/** Tolak work order request dan simpan alasan penolakan. */
export async function rejectRequestedWorkOrder(
  prisma: PrismaClient,
  id: string,
  rejectedById: string,
  reason: string,
): Promise<WorkOrders> {
  return prisma.workOrders.update({
    where: { id },
    data: {
      status: "CANCELLED",
      approvedById: rejectedById,
      approvedAt: new Date(),
      rejectionReason: reason,
      updatedAt: new Date(),
    },
  });
}

function buildRequestWhere(
  filters?: RequestFilterInput,
): Record<string, unknown> {
  const where: Record<string, unknown> = { status: "REQUESTED" };
  if (filters?.departmentId) {
    where.departmentId = filters.departmentId;
  }
  if (filters?.siteId) {
    where.siteId = filters.siteId;
  }
  if (!filters?.search) {
    return where;
  }
  where.OR = [
    { workOrderNumber: { contains: filters.search, mode: "insensitive" } },
    { title: { contains: filters.search, mode: "insensitive" } },
    { description: { contains: filters.search, mode: "insensitive" } },
  ];
  return where;
}
