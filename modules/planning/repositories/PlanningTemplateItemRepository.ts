import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningTemplateItemRepository,
  CreatePlanningTemplateItemInput,
  UpdatePlanningTemplateItemInput,
  FindAllPlanningTemplateItemFilters,
} from "../domain/ports/IPlanningTemplateItemRepository";
import type { PlanningTemplateItemEntity } from "../domain/entities/PlanningTemplateItemEntity";
import { PlanningTemplateItemMapper } from "../mappers/PlanningTemplateItemMapper";

export class PlanningTemplateItemRepository implements IPlanningTemplateItemRepository {
  /**
   * Find planning template item by ID
   */
  async findById(id: string): Promise<PlanningTemplateItemEntity | null> {
    const item = await prisma.planningTemplateItem.findUnique({
      where: { id },
    });

    return item ? PlanningTemplateItemMapper.toEntity(item) : null;
  }

  /**
   * Find all planning template items with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningTemplateItemFilters,
  ): Promise<{ items: PlanningTemplateItemEntity[]; total: number }> {
    const { tenantId, templateId, page = 1, limit = 50 } = filters;

    const where: Prisma.PlanningTemplateItemWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (templateId) {
      where.templateId = templateId;
    }

    const [items, total] = await Promise.all([
      prisma.planningTemplateItem.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningTemplateItem.count({ where }),
    ]);

    return {
      items: items.map((item) => PlanningTemplateItemMapper.toEntity(item)),
      total,
    };
  }

  /**
   * Find all items for a specific template
   */
  async findByTemplateId(
    templateId: string,
  ): Promise<PlanningTemplateItemEntity[]> {
    const items = await prisma.planningTemplateItem.findMany({
      where: { templateId },
      orderBy: { createdAt: "asc" },
    });

    return items.map((item) => PlanningTemplateItemMapper.toEntity(item));
  }

  /**
   * Create new planning template item
   */
  async create(
    data: CreatePlanningTemplateItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningTemplateItemEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningTemplateItemCreateInput = {
      template: {
        connect: { id: data.templateId },
      },
      tenant: {
        connect: { id: data.tenantId },
      },
      name: data.name,
      description: data.description ?? null,
      quantity: data.quantity,
      unit: data.unit,
      estimatedPrice: data.estimatedPrice ?? null,
      notes: data.notes ?? null,
    };

    const created = await client.planningTemplateItem.create({
      data: prismaData,
    });

    return PlanningTemplateItemMapper.toEntity(created);
  }

  /**
   * Update planning template item
   */
  async update(
    id: string,
    data: UpdatePlanningTemplateItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningTemplateItemEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningTemplateItemUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.quantity !== undefined) {
      updateData.quantity = data.quantity;
    }
    if (data.unit !== undefined) {
      updateData.unit = data.unit;
    }
    if (data.estimatedPrice !== undefined) {
      updateData.estimatedPrice = data.estimatedPrice;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await client.planningTemplateItem.update({
      where: { id },
      data: updateData,
    });

    return PlanningTemplateItemMapper.toEntity(updated);
  }

  /**
   * Delete planning template item
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningTemplateItem.delete({
      where: { id },
    });
  }

  /**
   * Delete all items for a specific template (cascade delete)
   */
  async deleteByTemplateId(
    templateId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;

    await client.planningTemplateItem.deleteMany({
      where: { templateId },
    });
  }
}
