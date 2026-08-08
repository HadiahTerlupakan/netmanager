import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  IPlanningRepository,
  CreatePlanningInput,
  UpdatePlanningInput,
  UpdateStatusInput,
  FindAllPlanningFilters,
} from "../domain/ports/IPlanningRepository";
import type {
  PlanningEntity,
  PlanningStatus,
} from "../domain/entities/PlanningEntity";
import { PlanningMapper } from "../mappers/PlanningMapper";

export class PlanningRepository implements IPlanningRepository {
  /**
   * Find planning by ID
   */
  async findById(id: string): Promise<PlanningEntity | null> {
    const planning = await prisma.planning.findUnique({
      where: { id },
    });

    return planning ? PlanningMapper.toEntity(planning) : null;
  }

  /**
   * Find all plannings with filters and pagination
   */
  async findAll(
    filters: FindAllPlanningFilters,
  ): Promise<{ items: PlanningEntity[]; total: number }> {
    const {
      tenantId,
      type,
      status,
      createdById,
      area,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.PlanningWhereInput = {
      deletedAt: null,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }
    if (type) {
      where.type = type;
    }
    if (status) {
      where.status = status;
    }
    if (createdById) {
      where.createdById = createdById;
    }
    if (area) {
      where.area = {
        contains: area,
        mode: "insensitive",
      };
    }

    const [plannings, total] = await Promise.all([
      prisma.planning.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.planning.count({ where }),
    ]);

    return {
      items: plannings.map((p) => PlanningMapper.toEntity(p)),
      total,
    };
  }

  /**
   * Find plannings by status
   */
  async findByStatus(
    status: PlanningStatus,
    tenantId?: string | null,
  ): Promise<PlanningEntity[]> {
    const where: Prisma.PlanningWhereInput = {
      status,
      deletedAt: null,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const plannings = await prisma.planning.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return plannings.map((p) => PlanningMapper.toEntity(p));
  }

  /**
   * Find plannings pending approval (PENDING_APPROVAL or APPROVED_LEVEL1)
   */
  async findPendingApproval(
    tenantId?: string | null,
  ): Promise<PlanningEntity[]> {
    const where: Prisma.PlanningWhereInput = {
      status: {
        in: ["PENDING_APPROVAL", "APPROVED_LEVEL1"],
      },
      deletedAt: null,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const plannings = await prisma.planning.findMany({
      where,
      orderBy: { submittedAt: "desc" },
    });

    return plannings.map((p) => PlanningMapper.toEntity(p));
  }

  /**
   * Find plannings created by specific user
   */
  async findByCreatedBy(
    userId: string,
    tenantId?: string | null,
  ): Promise<PlanningEntity[]> {
    const where: Prisma.PlanningWhereInput = {
      createdById: userId,
      deletedAt: null,
    };

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const plannings = await prisma.planning.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return plannings.map((p) => PlanningMapper.toEntity(p));
  }

  /**
   * Create new planning
   */
  async create(
    data: CreatePlanningInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningEntity> {
    const client = tx ?? prisma;

    const prismaData: Prisma.PlanningCreateInput = {
      tenant: {
        connect: { id: data.tenantId },
      },
      type: data.type,
      title: data.title,
      description: data.description ?? null,
      area: data.area,
      coordinates: (data.coordinates ??
        null) as unknown as Prisma.InputJsonValue,
      estimatedUnits: data.estimatedUnits,
      estimatedBudget: data.estimatedBudget ?? null,
      approvalLevel: data.approvalLevel,
      startDate: data.startDate ?? null,
      targetCompletionDate: data.targetCompletionDate ?? null,
      status: "BACKLOG",
      currentApprovalStep: 0,
      progressPercentage: 0,
      actualBudget: null,
      submittedAt: null,
      approvedAt: null,
      approvedLevel1At: null,
      rejectedAt: null,
      approvalNotes: null,
      actualCompletionDate: null,
      deletedAt: null,
    };

    if (data.createdById) {
      prismaData.createdBy = {
        connect: { id: data.createdById },
      };
    }

    const created = await client.planning.create({
      data: prismaData,
    });

    return PlanningMapper.toEntity(created);
  }

  /**
   * Update planning data
   */
  async update(
    id: string,
    data: UpdatePlanningInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningUpdateInput = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.area !== undefined) {
      updateData.area = data.area;
    }
    if (data.coordinates !== undefined) {
      updateData.coordinates =
        data.coordinates as unknown as Prisma.InputJsonValue;
    }
    if (data.estimatedUnits !== undefined) {
      updateData.estimatedUnits = data.estimatedUnits;
    }
    if (data.estimatedBudget !== undefined) {
      updateData.estimatedBudget = data.estimatedBudget;
    }
    if (data.actualBudget !== undefined) {
      updateData.actualBudget = data.actualBudget;
    }
    if (data.progressPercentage !== undefined) {
      updateData.progressPercentage = data.progressPercentage;
    }
    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate;
    }
    if (data.targetCompletionDate !== undefined) {
      updateData.targetCompletionDate = data.targetCompletionDate;
    }
    if (data.actualCompletionDate !== undefined) {
      updateData.actualCompletionDate = data.actualCompletionDate;
    }

    const updated = await client.planning.update({
      where: { id },
      data: updateData,
    });

    return PlanningMapper.toEntity(updated);
  }

  /**
   * Update planning status and related approval fields
   */
  async updateStatus(
    id: string,
    updates: UpdateStatusInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PlanningEntity> {
    const client = tx ?? prisma;

    const updateData: Prisma.PlanningUpdateInput = {
      status: updates.status,
    };

    if (updates.currentApprovalStep !== undefined) {
      updateData.currentApprovalStep = updates.currentApprovalStep;
    }
    if (updates.submittedAt !== undefined) {
      updateData.submittedAt = updates.submittedAt;
    }
    if (updates.submittedById !== undefined) {
      updateData.submittedBy = updates.submittedById
        ? { connect: { id: updates.submittedById } }
        : { disconnect: true };
    }
    if (updates.approvedAt !== undefined) {
      updateData.approvedAt = updates.approvedAt;
    }
    if (updates.approvedById !== undefined) {
      updateData.approvedBy = updates.approvedById
        ? { connect: { id: updates.approvedById } }
        : { disconnect: true };
    }
    if (updates.approvedLevel1At !== undefined) {
      updateData.approvedLevel1At = updates.approvedLevel1At;
    }
    if (updates.approvedLevel1ById !== undefined) {
      updateData.approvedLevel1By = updates.approvedLevel1ById
        ? { connect: { id: updates.approvedLevel1ById } }
        : { disconnect: true };
    }
    if (updates.rejectedAt !== undefined) {
      updateData.rejectedAt = updates.rejectedAt;
    }
    if (updates.rejectedById !== undefined) {
      updateData.rejectedBy = updates.rejectedById
        ? { connect: { id: updates.rejectedById } }
        : { disconnect: true };
    }
    if (updates.approvalNotes !== undefined) {
      updateData.approvalNotes = updates.approvalNotes;
    }

    const updated = await client.planning.update({
      where: { id },
      data: updateData,
    });

    return PlanningMapper.toEntity(updated);
  }

  /**
   * Soft delete planning (set deletedAt)
   */
  async delete(id: string, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? prisma;

    await client.planning.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
