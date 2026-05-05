import type { EmployeeType, Prisma } from "@prisma/client";
import type { SalaryEntity } from "../domain/entities/SalaryEntity";
import type { SalaryFilters } from "../domain/ports/ISalaryRepository";

/** Bangun include relasi lengkap untuk salary. */
export function buildSalaryFullInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        employeeType: true,
        departmentId: true,
        siteId: true,
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
    },
    details: { orderBy: { type: "asc" } },
    revisions: { orderBy: { createdAt: "desc" } },
    auditedBy: { select: { id: true, name: true } },
    approvedBy: { select: { id: true, name: true } },
  } satisfies Prisma.SalaryInclude;
}

/** Bangun where clause salary dari filter service. */
export function buildSalaryWhere(
  filters: SalaryFilters,
): Prisma.SalaryWhereInput {
  const where: Prisma.SalaryWhereInput = buildBaseSalaryWhere(filters);
  const userFilter = buildSalaryUserWhere(filters);
  if (!userFilter) {
    return where;
  }

  where.user = userFilter;
  return where;
}

function buildBaseSalaryWhere(filters: SalaryFilters): Prisma.SalaryWhereInput {
  const where: Prisma.SalaryWhereInput = {};
  if (filters.month) where.month = filters.month;
  if (filters.year) where.year = filters.year;
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;
  return where;
}

function buildSalaryUserWhere(filters: SalaryFilters) {
  if (!filters.departmentId && !filters.siteId && !filters.employeeType) {
    return null;
  }

  return {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
    ...(filters.employeeType
      ? { employeeType: filters.employeeType as EmployeeType }
      : {}),
  };
}

/** Bangun payload update status salary beserta audit trail. */
export function buildSalaryStatusUpdate(
  status: SalaryEntity["status"],
  userId?: string,
  notes?: string,
): Prisma.SalaryUpdateInput {
  const updateData: Prisma.SalaryUpdateInput = {
    status,
    updatedAt: new Date(),
  };

  if (status === "AUDITED" && userId) {
    updateData.auditedBy = { connect: { id: userId } };
    updateData.auditedAt = new Date();
    updateData.auditNotes = notes ?? null;
    return updateData;
  }

  if (status === "APPROVED" && userId) {
    updateData.approvedBy = { connect: { id: userId } };
    updateData.approvedAt = new Date();
    return updateData;
  }

  if (status === "PAID") {
    updateData.paidAt = new Date();
  }

  return updateData;
}
