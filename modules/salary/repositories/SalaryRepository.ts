import { prisma } from "@/lib/prisma";
import { SalaryMapper } from "../mappers/SalaryMapper";
import type {
  CreateSalaryDetailInput,
  CreateSalaryInput,
  ISalaryRepository,
  SalaryFilters,
  UpdateSalaryInput,
} from "../domain/ports/ISalaryRepository";
import type {
  SalaryEntity,
  SalaryPeriodStatsEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";
import {
  buildSalaryFullInclude,
  buildSalaryStatusUpdate,
  buildSalaryWhere,
} from "./SalaryRepository.helpers";

const EMPTY_TOTAL = 0;

export type { SalaryFilters } from "../domain/ports/ISalaryRepository";
export type {
  SalaryEntity,
  SalaryWithDetailsEntity,
} from "../domain/entities/SalaryEntity";

export class SalaryRepository implements ISalaryRepository {
  /** Get salary with details for aggregate calculation. */
  async findByIdWithDetailsOnly(
    id: string,
  ): Promise<SalaryWithDetailsEntity | null> {
    const salary = await prisma.salary.findUnique({
      where: { id },
      include: { details: true },
    });

    return salary ? SalaryMapper.toDomain(salary) : null;
  }

  /** Create a new salary record. */
  async create(
    userId: string,
    month: number,
    year: number,
    data: CreateSalaryInput,
  ): Promise<SalaryEntity> {
    const salary = await prisma.salary.create({
      data: {
        ...data,
        user: { connect: { id: userId } },
        month,
        year,
      },
    });

    return SalaryMapper.toDomainSalary(salary);
  }

  /** Find salary by ID with full details. */
  async findById(id: string): Promise<SalaryWithDetailsEntity | null> {
    const salary = await prisma.salary.findUnique({
      where: { id },
      include: buildSalaryFullInclude(),
    });

    return salary ? SalaryMapper.toDomain(salary) : null;
  }

  /** Find salary by user and period. */
  async findByUserPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<SalaryEntity | null> {
    const salary = await prisma.salary.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    return salary ? SalaryMapper.toDomainSalary(salary) : null;
  }

  /** Find all salaries with filters. */
  async findAll(
    filters: SalaryFilters = {},
  ): Promise<{ salaries: SalaryWithDetailsEntity[]; total: number }> {
    const where = buildSalaryWhere(filters);
    const [salaries, total] = await Promise.all([
      prisma.salary.findMany({
        where,
        include: {
          ...buildSalaryFullInclude(),
          revisions: false,
        },
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.salary.count({ where }),
    ]);

    return {
      salaries: salaries.map((salary) => SalaryMapper.toDomain(salary)),
      total,
    };
  }

  /** Update salary. */
  async update(id: string, data: UpdateSalaryInput): Promise<SalaryEntity> {
    const salary = await prisma.salary.update({
      where: { id },
      data,
    });

    return SalaryMapper.toDomainSalary(salary);
  }

  /** Update salary status with audit trail. */
  async updateStatus(
    id: string,
    status: SalaryEntity["status"],
    userId?: string,
    notes?: string,
  ): Promise<SalaryEntity> {
    const salary = await prisma.salary.update({
      where: { id },
      data: buildSalaryStatusUpdate(status, userId, notes),
    });

    return SalaryMapper.toDomainSalary(salary);
  }

  /** Delete salary and its details. */
  async delete(id: string): Promise<void> {
    await prisma.salary.delete({ where: { id } });
  }

  /** Upsert salary by user and period. */
  async upsert(
    userId: string,
    month: number,
    year: number,
    data: CreateSalaryInput,
  ): Promise<SalaryEntity> {
    const salary = await prisma.salary.upsert({
      where: { userId_month_year: { userId, month, year } },
      create: {
        ...data,
        user: { connect: { id: userId } },
        month,
        year,
      },
      update: data,
    });

    return SalaryMapper.toDomainSalary(salary);
  }

  /** Add salary detail. */
  async addDetail(salaryId: string, detail: CreateSalaryDetailInput) {
    const created = await prisma.salaryDetail.create({
      data: {
        ...detail,
        salary: { connect: { id: salaryId } },
      },
    });

    return SalaryMapper.toDomainDetail(created);
  }

  /** Add multiple details at once. */
  async addDetails(
    salaryId: string,
    details: CreateSalaryDetailInput[],
  ): Promise<number> {
    const result = await prisma.salaryDetail.createMany({
      data: details.map((detail) => ({ ...detail, salaryId })),
    });

    return result.count;
  }

  /** Clear all details for recalculation. */
  async clearDetails(salaryId: string): Promise<void> {
    await prisma.salaryDetail.deleteMany({ where: { salaryId } });
  }

  /** Add revision record. */
  async addRevision(
    salaryId: string,
    field: string,
    oldValue: string | null,
    newValue: string | null,
    reason: string,
    revisedById: string,
  ) {
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

  /** Get summary stats for a period. */
  async getPeriodStats(
    month: number,
    year: number,
  ): Promise<SalaryPeriodStatsEntity> {
    const [counts, totals] = await Promise.all([
      prisma.salary.groupBy({
        by: ["status"],
        where: { month, year },
        _count: true,
      }),
      prisma.salary.aggregate({
        where: { month, year, status: { in: ["APPROVED", "PAID"] } },
        _sum: { netSalary: true },
      }),
    ]);

    const countMap = counts.reduce<Record<string, number>>((map, item) => {
      map[item.status] = item._count;
      return map;
    }, {});

    return {
      total: Object.values(countMap).reduce(
        (sum, value) => sum + value,
        EMPTY_TOTAL,
      ),
      draft: countMap.DRAFT ?? EMPTY_TOTAL,
      calculated: countMap.CALCULATED ?? EMPTY_TOTAL,
      audited: countMap.AUDITED ?? EMPTY_TOTAL,
      approved: countMap.APPROVED ?? EMPTY_TOTAL,
      paid: countMap.PAID ?? EMPTY_TOTAL,
      totalNetSalary: totals._sum.netSalary ?? EMPTY_TOTAL,
    };
  }
}
