import type { PlanningItem, Prisma } from "@prisma/client";
import { PlanningItemEntity } from "../domain/entities/PlanningItemEntity";
import type {
  PlanningItemDTO,
  CreatePlanningItemDTO,
  UpdatePlanningItemDTO,
} from "../dto/PlanningItemDTO";

export class PlanningItemMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningItem): PlanningItemEntity {
    return new PlanningItemEntity({
      id: prisma.id,
      planningId: prisma.planningId,
      tenantId: prisma.tenantId,
      name: prisma.name,
      description: prisma.description,
      quantity: prisma.quantity,
      unit: prisma.unit,
      estimatedPrice: prisma.estimatedPrice,
      actualPrice: prisma.actualPrice,
      notes: prisma.notes,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  /**
   * Convert Entity to DTO
   */
  static toDTO(entity: PlanningItemEntity): PlanningItemDTO {
    return {
      id: entity.id,
      planningId: entity.planningId,
      name: entity.name,
      description: entity.description,
      quantity: entity.quantity,
      unit: entity.unit,
      estimatedPrice: entity.estimatedPrice,
      actualPrice: entity.actualPrice,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      totalEstimated: entity.getTotalEstimated(),
      totalActual: entity.getTotalActual(),
    };
  }

  /**
   * Convert Create DTO to Prisma create input
   */
  static toPrismaCreate(
    dto: CreatePlanningItemDTO,
    planningId: string,
    tenantId: string,
  ): Prisma.PlanningItemUncheckedCreateInput {
    return {
      planningId,
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      quantity: dto.quantity,
      unit: dto.unit,
      estimatedPrice: dto.estimatedPrice ?? null,
      actualPrice: null,
      notes: dto.notes ?? null,
    };
  }

  /**
   * Convert Update DTO to Prisma update input
   */
  static toPrismaUpdate(
    dto: UpdatePlanningItemDTO,
  ): Prisma.PlanningItemUpdateInput {
    const updateData: Prisma.PlanningItemUpdateInput = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.quantity !== undefined) {
      updateData.quantity = dto.quantity;
    }
    if (dto.unit !== undefined) {
      updateData.unit = dto.unit;
    }
    if (dto.estimatedPrice !== undefined) {
      updateData.estimatedPrice = dto.estimatedPrice;
    }
    if (dto.actualPrice !== undefined) {
      updateData.actualPrice = dto.actualPrice;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return updateData;
  }
}
