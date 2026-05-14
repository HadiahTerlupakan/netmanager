import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { getTenantIdFromContext } from "@/lib/tenant-context";
import type {
  CreateDepartmentRepositoryInput,
  DepartmentFilterOptions,
  IDepartmentRepository,
  UpdateDepartmentRepositoryInput,
} from "../domain/ports/IDepartmentRepository";
import type { DepartmentEntity } from "../domain/entities/DepartmentEntity";
import { DepartmentMapper } from "../mappers/DepartmentMapper";

export class DepartmentRepository implements IDepartmentRepository {
  /** Build tenant isolation where clause from request context. */
  private async getTenantWhere(): Promise<Prisma.DepartmentsWhereInput> {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (isSuperAdmin) return {};
    if (!tenantId) return { tenantId: "___MISSING_TENANT_ID___" };
    return { tenantId };
  }

  /** Get all departments with filters, scoped by tenant. */
  async findAll(
    filters: DepartmentFilterOptions = {},
  ): Promise<DepartmentEntity[]> {
    const tenantWhere = await this.getTenantWhere();
    const where = { ...this.buildWhereClause(filters), ...tenantWhere };
    const departments = await prisma.departments.findMany({
      where,
      include: {
        _count: { select: { user: true, work_orders: true } },
      },
      orderBy: { name: "asc" },
    });

    return DepartmentMapper.toDomains(departments);
  }

  /** Find department by ID, scoped by tenant. */
  async findById(id: string): Promise<DepartmentEntity | null> {
    const tenantWhere = await this.getTenantWhere();
    const department = await prisma.departments.findFirst({
      where: { id, ...tenantWhere },
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

  /** Find department by name, scoped by tenant. */
  async findByName(name: string): Promise<DepartmentEntity | null> {
    const tenantWhere = await this.getTenantWhere();
    const department = await prisma.departments.findFirst({
      where: { name, ...tenantWhere },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return department ? DepartmentMapper.toDomain(department) : null;
  }

  /** Create a department entity with tenant context. */
  async create(
    data: CreateDepartmentRepositoryInput,
  ): Promise<DepartmentEntity> {
    const { tenantId } = await getTenantIdFromContext();
    const department = await prisma.departments.create({
      data: {
        id: data.id || randomUUID(),
        name: data.name,
        description: data.description || null,
        jobDescription: data.jobDescription || null,
        isReminderTarget: data.isReminderTarget ?? false,
        showInMobileWO: data.showInMobileWO ?? false,
        tenantId: data.tenantId !== undefined ? data.tenantId : tenantId,
        updatedAt: data.updatedAt || new Date(),
      },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return DepartmentMapper.toDomain(department);
  }

  /** Update a department entity, scoped by tenant. */
  async update(
    id: string,
    data: UpdateDepartmentRepositoryInput,
  ): Promise<DepartmentEntity> {
    const tenantWhere = await this.getTenantWhere();

    // Verify the department belongs to the current tenant before updating
    const existing = await prisma.departments.findFirst({
      where: { id, ...tenantWhere },
    });
    if (!existing) {
      throw new Error("Department not found or access denied");
    }

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

  /** Find department by ID with counts, scoped by tenant. */
  async findByIdWithCounts(id: string): Promise<DepartmentEntity | null> {
    const tenantWhere = await this.getTenantWhere();
    const department = await prisma.departments.findFirst({
      where: { id, ...tenantWhere },
      include: { _count: { select: { user: true, work_orders: true } } },
    });

    return department ? DepartmentMapper.toDomain(department) : null;
  }

  /** Delete department by ID, scoped by tenant. */
  async delete(id: string): Promise<void> {
    const tenantWhere = await this.getTenantWhere();

    // Verify the department belongs to the current tenant before deleting
    const existing = await prisma.departments.findFirst({
      where: { id, ...tenantWhere },
    });
    if (!existing) {
      throw new Error("Department not found or access denied");
    }

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

    if (filters.showInMobileWO !== undefined) {
      where.showInMobileWO = filters.showInMobileWO;
    }

    return where;
  }
}
