import type {
  PlanningTemplate,
  PlanningTemplateItem,
  Prisma,
} from "@prisma/client";
import { PlanningTemplateEntity } from "../domain/entities/PlanningTemplateEntity";
import type {
  PlanningTemplateListItemDTO,
  PlanningTemplateDetailDTO,
  CreatePlanningTemplateDTO,
} from "../dto/PlanningTemplateDTO";

export class PlanningTemplateMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningTemplate): PlanningTemplateEntity {
    return new PlanningTemplateEntity({
      id: prisma.id,
      tenantId: prisma.tenantId,
      name: prisma.name,
      description: prisma.description,
      type: prisma.type as "OSP",
      isActive: prisma.isActive,
      createdById: prisma.createdById,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
    });
  }

  /**
   * Convert Entity to List DTO (summary view)
   */
  static toDTO(entity: PlanningTemplateEntity): PlanningTemplateListItemDTO {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      isActive: entity.isActive,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /**
   * Convert Entity to Detail DTO (with items)
   */
  static toDetailDTO(
    entity: PlanningTemplateEntity,
    items: PlanningTemplateItem[],
  ): PlanningTemplateDetailDTO {
    return {
      ...this.toDTO(entity),
      tenantId: entity.tenantId,
      createdById: entity.createdById,
      items: items.map((item) => ({
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        estimatedPrice: item.estimatedPrice,
      })),
    };
  }

  /**
   * Convert Create DTO to Prisma create input
   */
  static toPrismaCreate(
    dto: CreatePlanningTemplateDTO,
    tenantId: string,
    userId: string,
  ): Prisma.PlanningTemplateCreateInput {
    return {
      tenant: {
        connect: { id: tenantId },
      },
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      isActive: dto.isActive ?? true,
      createdBy: {
        connect: { id: userId },
      },
      items: {
        create: dto.items.map((item) => ({
          tenant: {
            connect: { id: tenantId },
          },
          name: item.name,
          description: item.description ?? null,
          quantity: item.quantity,
          unit: item.unit,
          estimatedPrice: item.estimatedPrice ?? null,
        })),
      },
    };
  }
}
