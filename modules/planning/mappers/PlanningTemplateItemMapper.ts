import type { PlanningTemplateItem, Prisma } from "@prisma/client";
import { PlanningTemplateItemEntity } from "../domain/entities/PlanningTemplateItemEntity";
import type {
  PlanningTemplateItemDTO,
  CreatePlanningTemplateItemDTO,
  UpdatePlanningTemplateItemDTO,
} from "../dto/PlanningTemplateItemDTO";

export class PlanningTemplateItemMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningTemplateItem): PlanningTemplateItemEntity {
    return new PlanningTemplateItemEntity({
      id: prisma.id,
      templateId: prisma.templateId,
      tenantId: prisma.tenantId,
      name: prisma.name,
      description: prisma.description,
      quantity: prisma.quantity,
      unit: prisma.unit,
      estimatedPrice: prisma.estimatedPrice,
      notes: prisma.notes,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  /**
   * Convert Entity to DTO
   */
  static toDTO(entity: PlanningTemplateItemEntity): PlanningTemplateItemDTO {
    return {
      id: entity.id,
      templateId: entity.templateId,
      name: entity.name,
      description: entity.description,
      quantity: entity.quantity,
      unit: entity.unit,
      estimatedPrice: entity.estimatedPrice,
      notes: entity.notes,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      totalEstimated: entity.getTotalEstimated(),
    };
  }

  /**
   * Convert Create DTO to Prisma create input
   */
  static toPrismaCreate(
    dto: CreatePlanningTemplateItemDTO,
    templateId: string,
    tenantId: string,
  ): Prisma.PlanningTemplateItemUncheckedCreateInput {
    return {
      templateId,
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      quantity: dto.quantity,
      unit: dto.unit,
      estimatedPrice: dto.estimatedPrice ?? null,
      notes: dto.notes ?? null,
    };
  }

  /**
   * Convert Update DTO to Prisma update input
   */
  static toPrismaUpdate(
    dto: UpdatePlanningTemplateItemDTO,
  ): Prisma.PlanningTemplateItemUpdateInput {
    const updateData: Prisma.PlanningTemplateItemUpdateInput = {};

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
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return updateData;
  }
}
