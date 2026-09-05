import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type {
  IPlanningMilestoneRepository,
  UpdatePlanningMilestoneInput,
} from "../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type { PlanningMilestoneDTO } from "../dto/PlanningMilestoneDTO";
import type { PlanningEntity } from "../domain/entities/PlanningEntity";
import type {
  MilestoneStatus,
  PlanningMilestoneEntity,
} from "../domain/entities/PlanningMilestoneEntity";
import { PlanningMilestoneMapper } from "../mappers/PlanningMilestoneMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "../errors/planning-errors";
import { logger } from "@/lib/logger";

/** Satu perubahan milestone dalam permintaan bulk update. */
export interface MilestoneUpdateRequest {
  id: string;
  status?: MilestoneStatus;
  actualDate?: string | null;
  notes?: string | null;
}

/**
 * PlanningMilestoneService
 *
 * Orkestrasi pembaruan milestone. Sebelumnya seluruh alur ini — pemeriksaan
 * kepemilikan, pemetaan DTO ke input repository, dan perulangan update —
 * berada di dalam route `app/api/planning/[id]/milestones`, memanggil
 * repository langsung dari controller.
 */
export class PlanningMilestoneService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly milestoneRepo: IPlanningMilestoneRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /** Lihat catatan tenant di `PlanningService.findOwnedPlanning`. */
  private async findOwnedPlanning(
    planningId: string,
    tenantId: string,
  ): Promise<PlanningEntity> {
    const planning = await this.planningRepo.findById(planningId);

    if (!planning || planning.tenantId !== tenantId) {
      throw new PlanningNotFoundError();
    }

    return planning;
  }

  /** Daftar milestone sebuah rencana. */
  async getByPlanningId(
    planningId: string,
    tenantId: string,
  ): Promise<PlanningMilestoneDTO[]> {
    await this.findOwnedPlanning(planningId, tenantId);

    const milestones = await this.milestoneRepo.findByPlanningId(planningId);
    return milestones.map((milestone) =>
      PlanningMilestoneMapper.toDTO(milestone),
    );
  }

  /**
   * Menyusun input repository dari satu permintaan perubahan, sekaligus
   * menegakkan aturan transisi milestone.
   *
   * Milestone yang BLOCKED tidak boleh langsung ditandai selesai. Sebelumnya
   * tidak ada guard apa pun, sehingga UI bisa memindahkan milestone BLOCKED
   * langsung ke COMPLETED — dan karena progres rencana dihitung dari jumlah
   * milestone COMPLETED, angkanya melonjak ke 100% padahal hambatan yang
   * memblokirnya tidak pernah diselesaikan.
   *
   * Sengaja memakai `isBlocked()` dan bukan `canBeCompleted()` di entity:
   * `canBeCompleted()` mensyaratkan status IN_PROGRESS, yang juga akan
   * memblokir transisi PENDING → COMPLETED — alur sah untuk milestone yang
   * selesai tanpa pernah ditandai berjalan.
   */
  private buildMilestoneUpdate(
    existing: PlanningMilestoneEntity,
    request: MilestoneUpdateRequest,
  ): UpdatePlanningMilestoneInput {
    if (request.status === "COMPLETED" && existing.isBlocked()) {
      throw new PlanningInvalidStateError(
        `Milestone "${existing.name}" masih berstatus BLOCKED dan tidak bisa langsung diselesaikan. Selesaikan dulu hambatannya.`,
      );
    }

    const updateData: UpdatePlanningMilestoneInput = {};

    if (request.status !== undefined) {
      updateData.status = request.status;
    }
    if (request.actualDate !== undefined) {
      updateData.actualDate = request.actualDate
        ? new Date(request.actualDate)
        : null;
    }
    if (request.notes !== undefined) {
      updateData.notes = request.notes;
    }

    return updateData;
  }

  /**
   * Bulk update milestone milik satu rencana.
   *
   * Seluruh perubahan ditulis dalam satu transaksi. Sebelumnya dijalankan
   * dengan `Promise.all` tanpa transaksi: bila satu milestone gagal, sebagian
   * sudah tersimpan sementara route tetap membalas error, sehingga pengguna
   * mengira tidak ada yang berubah padahal sebagian sudah berubah.
   */
  async bulkUpdate(
    planningId: string,
    requests: MilestoneUpdateRequest[],
    userId: string,
    tenantId: string,
  ): Promise<PlanningMilestoneDTO[]> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);

    // Seluruh milestone dimuat dan divalidasi lebih dulu, di luar transaksi,
    // supaya permintaan yang jelas salah ditolak tanpa membuka transaksi sama
    // sekali.
    const prepared = await Promise.all(
      requests.map(async (request) => {
        const existing = await this.milestoneRepo.findById(request.id);

        if (!existing || existing.planningId !== planningId) {
          throw new PlanningNotFoundError(
            `Milestone ${request.id} tidak ditemukan pada rencana ini`,
          );
        }

        return {
          id: request.id,
          existing,
          updateData: this.buildMilestoneUpdate(existing, request),
        };
      }),
    );

    const updated = await this.unitOfWork.runInTransaction(async (tx) => {
      const results: PlanningMilestoneEntity[] = [];

      for (const { id, updateData } of prepared) {
        results.push(await this.milestoneRepo.update(id, updateData, tx));
      }

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "MILESTONE_UPDATED",
          performedById: userId,
          changes: {
            milestones: prepared.map(({ id, existing, updateData }) => ({
              milestoneId: id,
              name: existing.name,
              from: existing.status,
              to: updateData.status ?? existing.status,
            })),
          },
        },
        tx,
      );

      return results;
    });

    logger.logActivity({
      action: "planning.milestones_updated",
      subject: "PlanningMilestone",
      details: {
        planningId,
        updatedCount: updated.length,
        milestoneIds: prepared.map(({ id }) => id),
      },
      userId,
      tenantId: planning.tenantId,
    });

    return updated.map((milestone) => PlanningMilestoneMapper.toDTO(milestone));
  }
}
