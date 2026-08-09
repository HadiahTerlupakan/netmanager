import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningTemplateRepository,
  CreatePlanningTemplateInput,
  UpdatePlanningTemplateInput,
  FindAllPlanningTemplateFilters,
} from "../domain/ports/IPlanningTemplateRepository";
import type {
  PlanningTemplateEntity,
  PlanningType,
} from "../domain/entities/PlanningTemplateEntity";
import { PlanningTemplateMapper } from "../mappers/PlanningTemplateMapper";

export class PlanningTemplateRepository implements IPlanningTemplateRepository {
  /**
   * Find planning template by ID
   */
  async findById(id: string): Promise<PlanningTemplateEntity | null> {
    const template = await prisma.planningTemplate.findUnique({
      where: { id },
    });

    return template ? PlanningTemplateMapper.toEntity(template) : null;
  }

  /**
   * Find all planning templates with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningTemplateFilters,
  ): Promise<{ items: PlanningTemplateEntity[]; total: number }> {
    const { tenantId, type, isActive, page = 1, limit = 20 } = filters;

    const where: Prisma.PlanningTemplateWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (type) {
      where.type = type;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [templates, total] = await Promise.all([
      prisma.planningTemplate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningTemplate.count({ where }),
    ]);

    return {
      items: templates.map((t) => PlanningTemplateMapper.toEntity(t)),
      total,
    };
  }

  /**
   * Find all active templates (isActive = true)
   */
  async findActive(
    tenantId?: string | null,
  ): Promise<PlanningTemplateEntity[]> {
    const where: Prisma.PlanningTemplateWhereInput = {
      isActive: true,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const templates = await prisma.planningTemplate.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return templates.map((t) => PlanningTemplateMapper.toEntity(t));
  }

  /**
   * Find templates by planning type
   */
  async findByType(
    type: PlanningType,
    tenantId?: string | null,
  ): Promise<PlanningTemplateEntity[]> {
    const where: Prisma.PlanningTemplateWhereInput = {
      type,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const templates = await prisma.planningTemplate.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return templates.map((t) => PlanningTemplateMapper.toEntity(t));
  }

  /**
   * Create new planning template
   */
  async create(
    data: CreatePlanningTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningTemplateEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningTemplateUncheckedCreateInput = {
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      isActive: data.isActive ?? true,
      createdById: data.createdById ?? null,
    };

    const created = await client.planningTemplate.create({
      data: prismaData,
    });

    return PlanningTemplateMapper.toEntity(created);
  }

  /**
   * Update planning template
   */
  async update(
    id: string,
    data: UpdatePlanningTemplateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningTemplateEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningTemplateUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.type !== undefined) {
      updateData.type = data.type;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    const updated = await client.planningTemplate.update({
      where: { id },
      data: updateData,
    });

    return PlanningTemplateMapper.toEntity(updated);
  }

  /**
   * Delete planning template
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningTemplate.delete({
      where: { id },
    });
  }
}
