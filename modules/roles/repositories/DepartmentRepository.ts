import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import type {
  CreateDepartmentRepositoryInput,
  DepartmentFilterOptions,
  IDepartmentRepository,
  UpdateDepartmentRepositoryInput,
} from "../domain/ports/IDepartmentRepository";
import type { DepartmentEntity } from "../domain/entities/DepartmentEntity";
import { DepartmentMapper } from "../mappers/DepartmentMapper";

export class DepartmentRepository implements IDepartmentRepository {
  /** Get all departments with filters. */
  async findAll(
    filters: DepartmentFilterOptions = {},
  ): Promise<DepartmentEntity[]> {
    const where = this.buildWhereClause(filters);
    const departments = await prisma.departments.findMany({
      where,
      include: {
        _count: { select: { user: true, work_orders: true } },
      },
      orderBy: { name: "asc" },
    });

    return DepartmentMapper.toDomains(departments);
  }

  /** Find department by ID. */
  async findById(id: string): Promise<DepartmentEntity | null> {
    const department = await prisma.departments.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, name: true },
          take: 10,
        },
        _count: { select: { user: true, work_orders: true } },
      },
    });

    return department ? DepartmentMapper.toDomain(department) : null;
  }

  /** Find department by name. */
  async findByName(name: string): Promise<DepartmentEntity | null> {
    const department = await prisma.departments.findFirst({
      where: { name },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return department ? DepartmentMapper.toDomain(department) : null;
  }

  /** Create a department entity. */
  async create(
    data: CreateDepartmentRepositoryInput,
  ): Promise<DepartmentEntity> {
    const department = await prisma.departments.create({
      data: {
        id: data.id || randomUUID(),
        name: data.name,
        description: data.description || null,
        jobDescription: data.jobDescription || null,
        isReminderTarget: data.isReminderTarget ?? false,
        showInMobileWO: data.showInMobileWO ?? false,
        updatedAt: data.updatedAt || new Date(),
      },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return DepartmentMapper.toDomain(department);
  }

  /** Update a department entity. */
  async update(
    id: string,
    data: UpdateDepartmentRepositoryInput,
  ): Promise<DepartmentEntity> {
    const department = await prisma.departments.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description || null,
        }),
        ...(data.jobDescription !== undefined && {
          jobDescription: data.jobDescription || null,
        }),
        ...(data.isReminderTarget !== undefined && {
          isReminderTarget: data.isReminderTarget,
        }),
        ...(data.showInMobileWO !== undefined && {
          showInMobileWO: data.showInMobileWO,
        }),
      },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return DepartmentMapper.toDomain(department);
  }

  /** Find department by ID with counts. */
  async findByIdWithCounts(id: string): Promise<DepartmentEntity | null> {
    const department = await prisma.departments.findUnique({
      where: { id },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return department ? DepartmentMapper.toDomain(department) : null;
  }

  /** Delete department by ID. */
  async delete(id: string): Promise<void> {
    await prisma.departments.delete({ where: { id } });
  }

  private buildWhereClause(
    filters: DepartmentFilterOptions,
  ): Prisma.DepartmentsWhereInput {
    const where: Prisma.DepartmentsWhereInput = {};
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.reminderOnly) {
      where.isReminderTarget = true;
    }

    return where;
  }
}
