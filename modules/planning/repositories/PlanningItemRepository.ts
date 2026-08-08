import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningItemRepository,
  CreatePlanningItemInput,
  UpdatePlanningItemInput,
  FindAllPlanningItemFilters,
} from "../domain/ports/IPlanningItemRepository";
import type { PlanningItemEntity } from "../domain/entities/PlanningItemEntity";
import { PlanningItemMapper } from "../mappers/PlanningItemMapper";

export class PlanningItemRepository implements IPlanningItemRepository {
  /**
   * Find planning item by ID
   */
  async findById(id: string): Promise<PlanningItemEntity | null> {
    const item = await prisma.planningItem.findUnique({
      where: { id },
    });

    return item ? PlanningItemMapper.toEntity(item) : null;
  }

  /**
   * Find all planning items with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningItemFilters,
  ): Promise<{ items: PlanningItemEntity[]; total: number }> {
    const { tenantId, planningId, page = 1, limit = 50 } = filters;

    const where: Prisma.PlanningItemWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (planningId) {
      where.planningId = planningId;
    }

    const [items, total] = await Promise.all([
      prisma.planningItem.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningItem.count({ where }),
    ]);

    return {
      items: items.map((item) => PlanningItemMapper.toEntity(item)),
      total,
    };
  }

  /**
   * Find all items for a specific planning
   */
  async findByPlanningId(planningId: string): Promise<PlanningItemEntity[]> {
    const items = await prisma.planningItem.findMany({
      where: { planningId },
      orderBy: { createdAt: "asc" },
    });

    return items.map((item) => PlanningItemMapper.toEntity(item));
  }

  /**
   * Get total estimated budget for a planning (sum of all items' estimatedPrice * quantity)
   */
  async getTotalEstimatedBudget(planningId: string): Promise<number> {
    const result = await prisma.planningItem.aggregate({
      where: {
        planningId,
        estimatedPrice: { not: null },
      },
      _sum: {
        estimatedPrice: true,
      },
    });

    // Note: This is a simplified calculation. For accurate total, we need quantity * price per item
    // Let's fetch items and calculate manually
    const items = await prisma.planningItem.findMany({
      where: {
        planningId,
        estimatedPrice: { not: null },
      },
      select: {
        quantity: true,
        estimatedPrice: true,
      },
    });

    const total = items.reduce((sum, item) => {
      if (item.estimatedPrice !== null) {
        return sum + item.quantity * item.estimatedPrice;
      }
      return sum;
    }, 0);

    return total;
  }

  /**
   * Create new planning item
   */
  async create(
    data: CreatePlanningItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningItemEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningItemCreateInput = {
      planning: {
        connect: { id: data.planningId },
      },
      tenant: {
        connect: { id: data.tenantId },
      },
      name: data.name,
      description: data.description ?? null,
      quantity: data.quantity,
      unit: data.unit,
      estimatedPrice: data.estimatedPrice ?? null,
      actualPrice: data.actualPrice ?? null,
      notes: data.notes ?? null,
    };

    const created = await client.planningItem.create({
      data: prismaData,
    });

    return PlanningItemMapper.toEntity(created);
  }

  /**
   * Update planning item
   */
  async update(
    id: string,
    data: UpdatePlanningItemInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningItemEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningItemUpdateInput = {};

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
    if (data.actualPrice !== undefined) {
      updateData.actualPrice = data.actualPrice;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await client.planningItem.update({
      where: { id },
      data: updateData,
    });

    return PlanningItemMapper.toEntity(updated);
  }

  /**
   * Delete planning item
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningItem.delete({
      where: { id },
    });
  }

  /**
   * Delete all items for a specific planning (cascade delete)
   */
  async deleteByPlanningId(
    planningId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? prisma;

    await client.planningItem.deleteMany({
      where: { planningId },
    });
  }
}
