import type { PlanningAuditLog, Prisma } from "@prisma/client";
import {
  PlanningAuditLogEntity,
  type AuditAction,
} from "../domain/entities/PlanningAuditLogEntity";
import type { PlanningAuditLogDTO } from "../dto/PlanningAuditLogDTO";

export class PlanningAuditLogMapper {
  /**
   * Convert Prisma model to Domain Entity
   */
  static toEntity(prisma: PlanningAuditLog): PlanningAuditLogEntity {
    return new PlanningAuditLogEntity({
      id: prisma.id,
      planningId: prisma.planningId,
      tenantId: prisma.tenantId,
      action: prisma.action as AuditAction,
      performedById: prisma.performedById,
      performedAt: prisma.performedAt,
      changes: prisma.changes as Record<string, unknown> | null,
      notes: prisma.notes,
    });
  }

  /**
   * Convert Entity to DTO
   */
  static toDTO(entity: PlanningAuditLogEntity): PlanningAuditLogDTO {
    return {
      id: entity.id,
      planningId: entity.planningId,
      action: entity.action,
      performedById: entity.performedById,
      performedAt: entity.performedAt.toISOString(),
      changes: entity.changes,
      notes: entity.notes,
      isCriticalAction: entity.isCriticalAction(),
      isSystemAction: entity.isSystemAction(),
    };
  }

  /**
   * Convert input to Prisma create input
   */
  static toPrismaCreate(data: {
    planningId: string;
    tenantId: string;
    action: AuditAction;
    performedById?: string | null;
    changes?: Record<string, unknown> | null;
    notes?: string | null;
  }): Prisma.PlanningAuditLogCreateInput {
    const prismaData: Prisma.PlanningAuditLogCreateInput = {
      planning: {
        connect: { id: data.planningId },
      },
      tenant: {
        connect: { id: data.tenantId },
      },
      action: data.action,
      changes: (data.changes ?? null) as unknown as Prisma.InputJsonValue,
      notes: data.notes ?? null,
    };

    if (data.performedById) {
      prismaData.performedBy = {
        connect: { id: data.performedById },
      };
    }

    return prismaData;
  }
}
