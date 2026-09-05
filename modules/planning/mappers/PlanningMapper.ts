import type { Planning, Prisma } from "@prisma/client";
import {
  calculateProgressFromMilestones,
  resolveBoqPricingState,
  hasBudgetMismatch,
  sumItemsEstimatedCost,
} from "../domain/planning-business-rules";
import {
  PlanningEntity,
  type PlanningStatus,
} from "../domain/entities/PlanningEntity";
import type {
  PlanningListItemDTO,
  PlanningDetailDTO,
  CreatePlanningDTO,
  UpdatePlanningDTO,
  Coordinates,
} from "../dto/PlanningDTO";
import type { PlanningItemEntity } from "../domain/entities/PlanningItemEntity";
import type { PlanningMilestoneEntity } from "../domain/entities/PlanningMilestoneEntity";
import type { PlanningDocumentEntity } from "../domain/entities/PlanningDocumentEntity";
import { PlanningItemMapper } from "./PlanningItemMapper";
import { PlanningMilestoneMapper } from "./PlanningMilestoneMapper";
import { PlanningDocumentMapper } from "./PlanningDocumentMapper";

export class PlanningMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: Planning): PlanningEntity {
    return new PlanningEntity({
      id: prisma.id,
      tenantId: prisma.tenantId,
      type: prisma.type as "OSP",
      title: prisma.title,
      description: prisma.description,
      area: prisma.area,
      coordinates: prisma.coordinates as unknown as Coordinates | null,
      estimatedUnits: prisma.estimatedUnits,
      estimatedBudget: prisma.estimatedBudget,
      actualBudget: prisma.actualBudget,
      status: prisma.status as PlanningStatus,
      approvalLevel: prisma.approvalLevel,
      currentApprovalStep: prisma.currentApprovalStep,
      submittedAt: prisma.submittedAt,
      submittedById: prisma.submittedById,
      approvedAt: prisma.approvedAt,
      approvedById: prisma.approvedById,
      approvedLevel1At: prisma.approvedLevel1At,
      approvedLevel1ById: prisma.approvedLevel1ById,
      rejectedAt: prisma.rejectedAt,
      rejectedById: prisma.rejectedById,
      approvalNotes: prisma.approvalNotes,
      progressPercentage: prisma.progressPercentage,
      startDate: prisma.startDate,
      targetCompletionDate: prisma.targetCompletionDate,
      actualCompletionDate: prisma.actualCompletionDate,
      createdById: prisma.createdById,
      createdAt: prisma.createdAt,
      updatedAt: prisma.updatedAt,
      deletedAt: prisma.deletedAt,
    });
  }

  /**
   * Convert Entity to List DTO (summary fields only)
   */
  static toDTO(entity: PlanningEntity): PlanningListItemDTO {
    return {
      id: entity.id,
      type: entity.type,
      title: entity.title,
      area: entity.area,
      status: entity.status,
      estimatedUnits: entity.estimatedUnits,
      estimatedBudget: entity.estimatedBudget,
      actualBudget: entity.actualBudget,
      progressPercentage: entity.progressPercentage,
      startDate: entity.startDate?.toISOString() ?? null,
      targetCompletionDate: entity.targetCompletionDate?.toISOString() ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /**
   * Convert Entity to Detail DTO (all fields + relations)
   */
  static toDetailDTO(
    entity: PlanningEntity,
    relations: {
      items: PlanningItemEntity[];
      milestones: PlanningMilestoneEntity[];
      documents: PlanningDocumentEntity[];
    },
  ): PlanningDetailDTO {
    const itemsTotalEstimatedCost = sumItemsEstimatedCost(relations.items);

    return {
      ...this.toDTO(entity),
      description: entity.description,
      coordinates: entity.coordinates,
      approvalLevel: entity.approvalLevel,
      currentApprovalStep: entity.currentApprovalStep,
      submittedAt: entity.submittedAt?.toISOString() ?? null,
      submittedById: entity.submittedById,
      approvedAt: entity.approvedAt?.toISOString() ?? null,
      approvedById: entity.approvedById,
      approvedLevel1At: entity.approvedLevel1At?.toISOString() ?? null,
      approvedLevel1ById: entity.approvedLevel1ById,
      rejectedAt: entity.rejectedAt?.toISOString() ?? null,
      rejectedById: entity.rejectedById,
      approvalNotes: entity.approvalNotes,
      actualCompletionDate: entity.actualCompletionDate?.toISOString() ?? null,
      createdById: entity.createdById,
      itemsTotalEstimatedCost,
      hasBudgetMismatch: hasBudgetMismatch(
        itemsTotalEstimatedCost,
        entity.estimatedBudget,
        resolveBoqPricingState(relations.items),
      ),
      milestoneProgressPercentage: calculateProgressFromMilestones(
        relations.milestones,
      ),
      items: relations.items.map((item) => PlanningItemMapper.toDTO(item)),
      milestones: relations.milestones.map((milestone) =>
        PlanningMilestoneMapper.toDTO(milestone),
      ),
      documents: relations.documents.map((doc) =>
        PlanningDocumentMapper.toDTO(doc),
      ),
    };
  }

  /**
   * Convert Create DTO to Prisma create input
   */
  static toPrismaCreate(
    dto: CreatePlanningDTO,
    tenantId: string,
    userId: string,
  ): Prisma.PlanningUncheckedCreateInput {
    const prismaData: Prisma.PlanningUncheckedCreateInput = {
      tenantId,
      type: dto.type,
      title: dto.title,
      description: dto.description ?? null,
      area: dto.area,
      coordinates: (dto.coordinates ??
        null) as unknown as Prisma.InputJsonValue,
      estimatedUnits: dto.estimatedUnits,
      estimatedBudget: dto.estimatedBudget ?? null,
      actualBudget: null,
      status: "BACKLOG",
      approvalLevel: dto.approvalLevel ?? 1,
      currentApprovalStep: 0,
      submittedAt: null,
      approvedAt: null,
      approvedLevel1At: null,
      rejectedAt: null,
      approvalNotes: null,
      progressPercentage: 0,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      targetCompletionDate: dto.targetCompletionDate
        ? new Date(dto.targetCompletionDate)
        : null,
      actualCompletionDate: null,
      deletedAt: null,
      createdById: userId || null,
    };

    return prismaData;
  }

  /**
   * Convert Update DTO to Prisma update input
   */
  static toPrismaUpdate(dto: UpdatePlanningDTO): Prisma.PlanningUpdateInput {
    const updateData: Prisma.PlanningUpdateInput = {};

    if (dto.title !== undefined) {
      updateData.title = dto.title;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.area !== undefined) {
      updateData.area = dto.area;
    }
    if (dto.coordinates !== undefined) {
      updateData.coordinates =
        dto.coordinates as unknown as Prisma.InputJsonValue;
    }
    if (dto.estimatedUnits !== undefined) {
      updateData.estimatedUnits = dto.estimatedUnits;
    }
    if (dto.estimatedBudget !== undefined) {
      updateData.estimatedBudget = dto.estimatedBudget;
    }
    if (dto.actualBudget !== undefined) {
      updateData.actualBudget = dto.actualBudget;
    }
    if (dto.progressPercentage !== undefined) {
      updateData.progressPercentage = dto.progressPercentage;
    }
    if (dto.startDate !== undefined) {
      updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.targetCompletionDate !== undefined) {
      updateData.targetCompletionDate = dto.targetCompletionDate
        ? new Date(dto.targetCompletionDate)
        : null;
    }

    return updateData;
  }
}
