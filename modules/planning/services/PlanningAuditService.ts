import type { IPlanningAuditLogRepository } from "../domain/ports/IPlanningAuditLogRepository";
import type { TransactionClient } from "../domain/ports/IPlanningRepository";
import type { AuditAction } from "../domain/entities/PlanningAuditLogEntity";
import type { PlanningAuditLogDTO } from "../dto/PlanningAuditLogDTO";
import { PlanningAuditLogMapper } from "../mappers/PlanningAuditLogMapper";
import { logger } from "@/lib/logger";

/**
 * Masukan satu entri audit.
 *
 * Berbentuk object, bukan enam parameter posisional: urutan `performedById`,
 * `changes`, dan `notes` yang semuanya nullable mudah tertukar tanpa ketahuan
 * compiler, dan `tenantId` yang baru ditambahkan menjadikannya tujuh.
 */
export interface LogPlanningChangeInput {
  planningId: string;
  tenantId: string;
  action: AuditAction;
  performedById: string | null;
  changes?: Record<string, unknown> | null;
  notes?: string | null;
}

/**
 * PlanningAuditService
 * Service untuk membuat audit trail entries untuk semua perubahan planning.
 * Digunakan oleh service lain untuk logging compliance dan transparency.
 */
export class PlanningAuditService {
  constructor(private readonly auditLogRepo: IPlanningAuditLogRepository) {}

  /**
   * Log perubahan pada planning record.
   *
   * `tenantId` wajib dan diambil dari rencana yang bersangkutan, bukan dari
   * sesi. Sebelumnya nilai ini dikirim sebagai string kosong dengan komentar
   * "will be set by repository from planning" — repository tidak pernah
   * melakukannya. Untuk pengguna tenant biasa hal itu tertutup kebetulan oleh
   * ekstensi isolasi Prisma yang menghapus lalu menimpa `tenantId`; untuk
   * super admin ekstensi hanya menyuntik bila nilainya `undefined`, sehingga
   * string kosong lolos ke database dan melanggar foreign key `Restrict` ke
   * tabel Tenant. Akibatnya rencana tersimpan, audit gagal, dan API membalas
   * 500 — pengguna mengira gagal lalu mengulang, menumpuk rencana duplikat.
   */
  async logChange(
    input: LogPlanningChangeInput,
    tx?: TransactionClient,
  ): Promise<PlanningAuditLogDTO> {
    const { planningId, tenantId, action, performedById, changes, notes } =
      input;

    try {
      const entity = await this.auditLogRepo.create(
        {
          planningId,
          tenantId,
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
