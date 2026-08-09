import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningMilestoneRepository,
  CreatePlanningMilestoneInput,
  UpdatePlanningMilestoneInput,
  FindAllPlanningMilestoneFilters,
} from "../domain/ports/IPlanningMilestoneRepository";
import type {
  PlanningMilestoneEntity,
  MilestoneStatus,
} from "../domain/entities/PlanningMilestoneEntity";
import { PlanningMilestoneMapper } from "../mappers/PlanningMilestoneMapper";

export class PlanningMilestoneRepository implements IPlanningMilestoneRepository {
  /**
   * Find planning milestone by ID
   */
  async findById(id: string): Promise<PlanningMilestoneEntity | null> {
    const milestone = await prisma.planningMilestone.findUnique({
      where: { id },
    });

    return milestone ? PlanningMilestoneMapper.toEntity(milestone) : null;
  }

  /**
   * Find all planning milestones with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningMilestoneFilters,
  ): Promise<{ items: PlanningMilestoneEntity[]; total: number }> {
    const { tenantId, planningId, status, page = 1, limit = 20 } = filters;

    const where: Prisma.PlanningMilestoneWhereInput = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (planningId) {
      where.planningId = planningId;
    }
    if (status) {
      where.status = status;
    }

    const [milestones, total] = await Promise.all([
      prisma.planningMilestone.findMany({
        where,
        orderBy: { targetDate: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planningMilestone.count({ where }),
    ]);

    return {
      items: milestones.map((m) => PlanningMilestoneMapper.toEntity(m)),
      total,
    };
  }

  /**
   * Find all milestones for a specific planning
   */
  async findByPlanningId(
    planningId: string,
  ): Promise<PlanningMilestoneEntity[]> {
    const milestones = await prisma.planningMilestone.findMany({
      where: { planningId },
      orderBy: { targetDate: "asc" },
    });

    return milestones.map((m) => PlanningMilestoneMapper.toEntity(m));
  }

  /**
   * Find milestones by status for a specific planning
   */
  async findByStatus(
    planningId: string,
    status: MilestoneStatus,
  ): Promise<PlanningMilestoneEntity[]> {
    const milestones = await prisma.planningMilestone.findMany({
      where: {
        planningId,
        status,
      },
      orderBy: { targetDate: "asc" },
    });

    return milestones.map((m) => PlanningMilestoneMapper.toEntity(m));
  }

  /**
   * Create new planning milestone
   */
  async create(
    data: CreatePlanningMilestoneInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningMilestoneEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningMilestoneUncheckedCreateInput = {
      planningId: data.planningId,
      tenantId: data.tenantId,
      name: data.name,
      description: data.description ?? null,
      targetDate: data.targetDate,
      status: data.status ?? "PENDING",
      notes: data.notes ?? null,
      actualDate: null,
    };

    const created = await client.planningMilestone.create({
      data: prismaData,
    });

    return PlanningMilestoneMapper.toEntity(created);
  }

  /**
   * Update planning milestone
   */
  async update(
    id: string,
    data: UpdatePlanningMilestoneInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningMilestoneEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningMilestoneUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.targetDate !== undefined) {
      updateData.targetDate = data.targetDate;
    }
    if (data.actualDate !== undefined) {
      updateData.actualDate = data.actualDate;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await client.planningMilestone.update({
      where: { id },
      data: updateData,
    });

    return PlanningMilestoneMapper.toEntity(updated);
  }

  /**
   * Update milestone status and optionally set actual completion date
   */
  async updateStatus(
    id: string,
    status: MilestoneStatus,
    actualDate?: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningMilestoneEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningMilestoneUpdateInput = {
      status,
    };

    if (actualDate !== undefined) {
      updateData.actualDate = actualDate;
    }

    const updated = await client.planningMilestone.update({
      where: { id },
      data: updateData,
    });

    return PlanningMilestoneMapper.toEntity(updated);
  }

  /**
   * Delete planning milestone
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planningMilestone.delete({
      where: { id },
    });
  }
}
