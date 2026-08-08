import type { PlanningMilestone, Prisma } from "@prisma/client";
import {
  PlanningMilestoneEntity,
  type MilestoneStatus,
} from "../domain/entities/PlanningMilestoneEntity";
import type {
  PlanningMilestoneDTO,
  UpdatePlanningMilestoneDTO,
} from "../dto/PlanningMilestoneDTO";

export class PlanningMilestoneMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningMilestone): PlanningMilestoneEntity {
    return new PlanningMilestoneEntity({
      id: prisma.id,
      planningId: prisma.planningId,
      tenantId: prisma.tenantId,
      name: prisma.name,
      description: prisma.description,
      targetDate: prisma.targetDate,
      actualDate: prisma.actualDate,
      status: prisma.status as MilestoneStatus,
      notes: prisma.notes,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  /**
   * Convert Entity to DTO
   */
  static toDTO(entity: PlanningMilestoneEntity): PlanningMilestoneDTO {
    return {
      id: entity.id,
      planningId: entity.planningId,
      name: entity.name,
      description: entity.description,
      targetDate: entity.targetDate.toISOString(),
      actualDate: entity.actualDate?.toISOString() ?? null,
      status: entity.status,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      isOverdue: entity.isOverdue(),
      daysRemaining: entity.getDaysRemaining(),
    };
  }

  /**
   * Convert Update DTO to Prisma update input
   */
  static toPrismaUpdate(
    dto: UpdatePlanningMilestoneDTO,
  ): Prisma.PlanningMilestoneUpdateInput {
    const updateData: Prisma.PlanningMilestoneUpdateInput = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }
    if (dto.actualDate !== undefined) {
      updateData.actualDate = dto.actualDate ? new Date(dto.actualDate) : null;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return updateData;
  }
}
