import { prisma } from "@/lib/prisma";
import type {
  Salary,
  SalaryStatus,
  SalaryDetail,
  SalaryRevision,
  EmployeeType,
  Prisma,
} from "@prisma/client";

export interface SalaryWithDetails extends Salary {
  user: {
    id: string;
    name: string | null;
    email: string;
    employeeType: string;
    departmentId: string | null;
    siteId: string | null;
    departments?: { name: string } | null;
    sites?: { name: string } | null;
  };
  details: SalaryDetail[];
  revisions?: SalaryRevision[];
  auditedBy?: { id: string; name: string | null } | null;
  approvedBy?: { id: string; name: string | null } | null;
}

export interface SalaryFilters {
  month?: number;
  year?: number;
  status?: SalaryStatus;
  userId?: string;
  departmentId?: string;
  siteId?: string;
  employeeType?: string;
  skip?: number;
  take?: number;
}

export class SalaryRepository {
  /** Get salary with details for aggregate calculation. */
  async findByIdWithDetailsOnly(id: string) {
    return prisma.salary.findUnique({
      where: { id },
      include: {
        details: true,
      },
    });
  }
  /**
   * Create a new salary record
   */
  async create(data: Prisma.SalaryCreateInput): Promise<Salary> {
    return prisma.salary.create({
      data,
    });
  }

  /**
   * Find salary by ID with full details
   */
  async findById(id: string): Promise<SalaryWithDetails | null> {
    return prisma.salary.findUnique({
      where: { id },
      include: {
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
        details: {
          orderBy: { type: "asc" },
        },
        revisions: {
          orderBy: { createdAt: "desc" },
        },
        auditedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    }) as Promise<SalaryWithDetails | null>;
  }

  /**
   * Find salary by user and period
   */
  async findByUserPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<Salary | null> {
    return prisma.salary.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
    });
  }

  /**
   * Find all salaries with filters
   */
  async findAll(
    filters: SalaryFilters = {},
  ): Promise<{ salaries: SalaryWithDetails[]; total: number }> {
    const where: Prisma.SalaryWhereInput = {};

    if (filters.month) where.month = filters.month;
    if (filters.year) where.year = filters.year;
    if (filters.status) where.status = filters.status;
    if (filters.userId) where.userId = filters.userId;

    if (filters.departmentId || filters.siteId || filters.employeeType) {
      where.user = {
        ...(filters.departmentId && { departmentId: filters.departmentId }),
        ...(filters.siteId && { siteId: filters.siteId }),
        ...(filters.employeeType && {
          employeeType: filters.employeeType as EmployeeType,
        }),
      };
    }

    const [salaries, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        include: {
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
          details: {
            orderBy: { type: "asc" },
          },
          auditedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.salary.count({ where }),
    ]);

    return { salaries: salaries as SalaryWithDetails[], total };
  }

  /**
   * Update salary
   */
  async update(id: string, data: Prisma.SalaryUpdateInput): Promise<Salary> {
    return prisma.salary.update({
      where: { id },
      data,
    });
  }

  /**
   * Update salary status with audit trail
   */
  async updateStatus(
    id: string,
    status: SalaryStatus,
    userId?: string,
    notes?: string,
  ): Promise<Salary> {
    const updateData: Prisma.SalaryUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    if (status === "AUDITED" && userId) {
      updateData.auditedBy = { connect: { id: userId } };
      updateData.auditedAt = new Date();
      if (notes) updateData.auditNotes = notes;
    } else if (status === "APPROVED" && userId) {
      updateData.approvedBy = { connect: { id: userId } };
      updateData.approvedAt = new Date();
    } else if (status === "PAID") {
      updateData.paidAt = new Date();
    }

    return prisma.salary.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete salary and its details
   */
  async delete(id: string): Promise<void> {
    await prisma.salary.delete({
      where: { id },
    });
  }

  /**
   * Upsert salary (create or update)
   */
  async upsert(
    userId: string,
    month: number,
    year: number,
    data: Omit<Prisma.SalaryCreateInput, "user" | "month" | "year">,
  ): Promise<Salary> {
    return prisma.salary.upsert({
      where: {
        userId_month_year: { userId, month, year },
      },
      create: {
        ...data,
        user: { connect: { id: userId } },
        month,
        year,
      },
      update: data,
    });
  }

  /**
   * Add salary detail
   */
  async addDetail(
    salaryId: string,
    detail: Omit<Prisma.SalaryDetailCreateInput, "salary">,
  ): Promise<SalaryDetail> {
    return prisma.salaryDetail.create({
      data: {
        ...detail,
        salary: { connect: { id: salaryId } },
      },
    });
  }

  /**
   * Add multiple details at once
   */
  async addDetails(
    salaryId: string,
    details: Array<Omit<Prisma.SalaryDetailCreateManyInput, "salaryId">>,
  ): Promise<number> {
    const result = await prisma.salaryDetail.createMany({
      data: details.map((d) => ({ ...d, salaryId })),
    });
    return result.count;
  }

  /**
   * Clear all details for recalculation
   */
  async clearDetails(salaryId: string): Promise<void> {
    await prisma.salaryDetail.deleteMany({
      where: { salaryId },
    });
  }

  /**
   * Add revision record
   */
  async addRevision(
    salaryId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    reason: string,
    revisedById: string,
  ): Promise<SalaryRevision> {
    return prisma.salaryRevision.create({
      data: {
        salaryId,
        field,
        oldValue,
        newValue,
        reason,
        revisedById,
      },
    });
  }

  /**
   * Get summary stats for a period
   */
  async getPeriodStats(
    month: number,
    year: number,
  ): Promise<{
    total: number;
    draft: number;
    calculated: number;
    audited: number;
    approved: number;
    paid: number;
    totalNetSalary: number;
  }> {
    const [counts, totals] = await Promise.all([
      prisma.salary.groupBy({
        by: ["status"],
        where: { month, year },
        _count: true,
      }),
      prisma.salary.aggregate({
        where: { month, year, status: { in: ["APPROVED", "PAID"] } },
        _sum: { netSalary: true },
        _count: true,
      }),
    ]);

    const countMap = counts.reduce(
      (acc, c) => {
        acc[c.status] = c._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      total: Object.values(countMap).reduce((a, b) => a + b, 0),
      draft: countMap.DRAFT || 0,
      calculated: countMap.CALCULATED || 0,
      audited: countMap.AUDITED || 0,
      approved: countMap.APPROVED || 0,
      paid: countMap.PAID || 0,
      totalNetSalary: totals._sum.netSalary || 0,
    };
  }
}
