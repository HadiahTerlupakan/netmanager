import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type {
  IPlanningItemRepository,
  UpdatePlanningItemInput,
} from "../domain/ports/IPlanningItemRepository";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type {
  PlanningItemDTO,
  CreatePlanningItemDTO,
} from "../dto/PlanningItemDTO";
import type { PlanningEntity } from "../domain/entities/PlanningEntity";
import type { PlanningItemEntity } from "../domain/entities/PlanningItemEntity";
import { PlanningItemMapper } from "../mappers/PlanningItemMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "../errors/planning-errors";
import { logger } from "@/lib/logger";

/**
 * PlanningItemService
 *
 * Mengelola item BOQ sebuah rencana. Sebelumnya tidak ada service untuk ini
 * sama sekali: route `app/api/planning/[id]/items` memanggil repository
 * langsung dan menaruh aturan `canBeEdited()` beserta pemeriksaan kepemilikan
 * item di controller — melanggar arah dependensi app → api → services →
 * repositories.
 *
 * Konsekuensinya bukan hanya soal tata letak. Karena tidak ada service,
 * mutasi item tidak pernah menulis audit: action `ITEM_ADDED`, `ITEM_UPDATED`,
 * dan `ITEM_REMOVED` terdefinisi di domain dan di enum Prisma tetapi tidak
 * pernah dipakai, sehingga menghapus material senilai ratusan juta dari sebuah
 * rencana tidak meninggalkan jejak siapa pun.
 */
export class PlanningItemService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /**
   * Mengambil rencana milik tenant pemanggil.
   * Lihat catatan tenant di `PlanningService.findOwnedPlanning`.
   */
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

  /**
   * Memastikan BOQ rencana ini masih boleh diubah.
   * BOQ adalah bagian dari ruang lingkup, jadi terkunci begitu rencana
   * diajukan — mengubahnya setelah itu membatalkan makna persetujuan.
   */
  private assertItemsEditable(planning: PlanningEntity): void {
    if (!planning.canBeEdited()) {
      throw new PlanningInvalidStateError(
        `Material rencana berstatus ${planning.status} tidak bisa diubah. Hanya rencana berstatus BACKLOG atau REJECTED yang bisa diubah.`,
      );
    }
  }

  /** Mengambil satu item yang benar-benar milik rencana tersebut. */
  private async findItemOfPlanning(
    itemId: string,
    planningId: string,
  ): Promise<PlanningItemEntity> {
    const item = await this.itemRepo.findById(itemId);

    if (!item || item.planningId !== planningId) {
      throw new PlanningNotFoundError("Material tidak ditemukan");
    }

    return item;
  }

  /** Daftar item BOQ sebuah rencana. */
  async getByPlanningId(
    planningId: string,
    tenantId: string,
  ): Promise<PlanningItemDTO[]> {
    await this.findOwnedPlanning(planningId, tenantId);

    const items = await this.itemRepo.findByPlanningId(planningId);
    return items.map((item) => PlanningItemMapper.toDTO(item));
  }

  /** Menambahkan satu item BOQ. */
  async create(
    planningId: string,
    dto: CreatePlanningItemDTO,
    userId: string,
    tenantId: string,
  ): Promise<PlanningItemDTO> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertItemsEditable(planning);

    const item = await this.unitOfWork.runInTransaction(async (tx) => {
      const created = await this.itemRepo.create(
        {
          planningId,
          tenantId: planning.tenantId,
          name: dto.name,
          description: dto.description ?? null,
          quantity: dto.quantity,
          unit: dto.unit,
          estimatedPrice: dto.estimatedPrice ?? null,
          notes: dto.notes ?? null,
        },
        tx,
      );

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "ITEM_ADDED",
          performedById: userId,
          changes: {
            itemId: created.id,
            name: created.name,
            quantity: created.quantity,
            unit: created.unit,
            estimatedPrice: created.estimatedPrice,
          },
        },
        tx,
      );

      return created;
    });

    logger.logActivity({
      action: "planning.item_added",
      subject: "PlanningItem",
      details: { planningId, itemId: item.id, itemName: item.name },
      userId,
      tenantId: planning.tenantId,
    });

    return PlanningItemMapper.toDTO(item);
  }

  /** Mengubah satu item BOQ. */
  async update(
    planningId: string,
    itemId: string,
    dto: UpdatePlanningItemInput,
    userId: string,
    tenantId: string,
  ): Promise<PlanningItemDTO> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertItemsEditable(planning);

    const existing = await this.findItemOfPlanning(itemId, planningId);

    const updatedItem = await this.unitOfWork.runInTransaction(async (tx) => {
      const updated = await this.itemRepo.update(itemId, dto, tx);

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "ITEM_UPDATED",
          performedById: userId,
          changes: {
            itemId,
            name: existing.name,
            fields: Object.keys(dto),
          },
        },
        tx,
      );

      return updated;
    });

    logger.logActivity({
      action: "planning.item_updated",
      subject: "PlanningItem",
      details: { planningId, itemId, changes: Object.keys(dto) },
      userId,
      tenantId: planning.tenantId,
    });

    return PlanningItemMapper.toDTO(updatedItem);
  }

  /** Menghapus satu item BOQ. */
  async delete(
    planningId: string,
    itemId: string,
    userId: string,
    tenantId: string,
  ): Promise<void> {
    const planning = await this.findOwnedPlanning(planningId, tenantId);
    this.assertItemsEditable(planning);

    const existing = await this.findItemOfPlanning(itemId, planningId);

    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.itemRepo.delete(itemId, tx);

      await this.auditService.logChange(
        {
          planningId,
          tenantId: planning.tenantId,
          action: "ITEM_REMOVED",
          performedById: userId,
          changes: {
            itemId,
            name: existing.name,
            quantity: existing.quantity,
            unit: existing.unit,
            estimatedPrice: existing.estimatedPrice,
          },
        },
        tx,
      );
    });

    logger.logActivity({
      action: "planning.item_deleted",
      subject: "PlanningItem",
      details: { planningId, itemId, itemName: existing.name },
      userId,
      tenantId: planning.tenantId,
    });
  }
}
