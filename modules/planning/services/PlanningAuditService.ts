import type { Prisma } from "@prisma/client";
import type { IPlanningAuditLogRepository } from "../domain/ports/IPlanningAuditLogRepository";
import type { AuditAction } from "../domain/entities/PlanningAuditLogEntity";
import type { PlanningAuditLogDTO } from "../dto/PlanningAuditLogDTO";
import { PlanningAuditLogMapper } from "../mappers/PlanningAuditLogMapper";
import { logger } from "@/lib/logger";

type PrismaTransaction = Prisma.TransactionClient;

/**
 * PlanningAuditService
 * Service untuk membuat audit trail entries untuk semua perubahan planning.
 * Digunakan oleh service lain untuk logging compliance dan transparency.
 */
export class PlanningAuditService {
  constructor(private readonly auditLogRepo: IPlanningAuditLogRepository) {}

  /**
   * Log perubahan pada planning record
   * @param planningId - ID planning yang berubah
   * @param action - Tipe aksi yang dilakukan
   * @param performedById - ID user yang melakukan aksi
   * @param changes - Object berisi detail perubahan
   * @param notes - Catatan tambahan (opsional)
   * @param tx - Prisma transaction (opsional)
   */
  async logChange(
    planningId: string,
    action: AuditAction,
    performedById: string | null,
    changes: Record<string, unknown> | null,
    notes?: string | null,
    tx?: PrismaTransaction,
  ): Promise<PlanningAuditLogDTO> {
    try {
      const entity = await this.auditLogRepo.create(
        {
          planningId,
          tenantId: "", // Will be set by repository from planning
          action,
          performedById: performedById ?? null,
          changes: changes ?? null,
          notes: notes ?? null,
        },
        tx,
      );

      logger.debug(`Audit log created: ${action} for planning ${planningId}`, {
        planningId,
        action,
        performedById,
      });

      return PlanningAuditLogMapper.toDTO(entity);
    } catch (error) {
      logger.error("Failed to create audit log", error, {
        planningId,
        action,
        performedById,
      });
      throw new Error(
        `Failed to create audit log for planning ${planningId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get audit history untuk planning tertentu
   */
  async getAuditHistory(
    planningId: string,
    options?: { page?: number; limit?: number },
  ): Promise<{ items: PlanningAuditLogDTO[]; total: number }> {
    const { items, total } = await this.auditLogRepo.findByPlanningId(
      planningId,
      {
        page: options?.page,
        limit: options?.limit,
      },
    );

    return {
      items: items.map((entity) => PlanningAuditLogMapper.toDTO(entity)),
      total,
    };
  }

  /**
   * Get audit logs by specific action
   */
  async getByAction(
    planningId: string,
    action: AuditAction,
  ): Promise<PlanningAuditLogDTO[]> {
    const entities = await this.auditLogRepo.findByAction(planningId, action);
    return entities.map((entity) => PlanningAuditLogMapper.toDTO(entity));
  }
}
