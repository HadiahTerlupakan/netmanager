import type {
  IPlanningTemplateRepository,
  FindAllPlanningTemplateFilters,
  CreatePlanningTemplateInput,
  UpdatePlanningTemplateInput,
} from "../domain/ports/IPlanningTemplateRepository";
import type {
  IPlanningTemplateItemRepository,
  CreatePlanningTemplateItemInput,
} from "../domain/ports/IPlanningTemplateItemRepository";
import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type {
  IPlanningItemRepository,
  CreatePlanningItemInput,
} from "../domain/ports/IPlanningItemRepository";
import type {
  PlanningTemplateListItemDTO,
  PlanningTemplateDetailDTO,
  CreatePlanningTemplateDTO,
  UpdatePlanningTemplateDTO,
} from "../dto/PlanningTemplateDTO";
import type { CreatePlanningDTO, PlanningDetailDTO } from "../dto/PlanningDTO";
import type { PlanningType } from "../domain/entities/PlanningEntity";
import { PlanningTemplateMapper } from "../mappers/PlanningTemplateMapper";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type { TransactionClient } from "../domain/ports/IPlanningRepository";
import type { PlanningTemplateEntity } from "../domain/entities/PlanningTemplateEntity";
import type { PlanningTemplateItemEntity } from "../domain/entities/PlanningTemplateItemEntity";
import { resolveApprovalLevel } from "../domain/planning-business-rules";
import {
  PlanningInvalidStateError,
  PlanningTemplateNotFoundError,
} from "../errors/planning-errors";
import { logger } from "@/lib/logger";

/**
 * PlanningTemplateService
 * Service untuk mengelola template planning dan apply template ke planning baru.
 */
export class PlanningTemplateService {
  constructor(
    private readonly templateRepo: IPlanningTemplateRepository,
    private readonly templateItemRepo: IPlanningTemplateItemRepository,
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /**
   * Mengambil template milik tenant pemanggil, atau melempar bila tidak ada.
   *
   * Guard ini sudah ada di `applyTemplate` sejak celah lintas tenant ditambal,
   * tetapi `getById`, `update`, dan `delete` di service yang sama tidak
   * memilikinya — super admin masih bisa membaca, mengubah, bahkan menghapus
   * seluruh BOQ baku tenant lain, sementara "Terapkan Template" pada template
   * yang sama ditolak. Dua kebijakan berbeda untuk satu objek yang sama.
   */
  private async findOwnedTemplate(
    id: string,
    tenantId: string,
  ): Promise<PlanningTemplateEntity> {
    const template = await this.templateRepo.findById(id);

    if (!template || template.tenantId !== tenantId) {
      throw new PlanningTemplateNotFoundError();
    }

    return template;
  }

  /**
   * Menulis ulang seluruh item template di dalam transaksi yang diberikan.
   * Dipakai bersama oleh create dan update supaya penyalinan BOQ hanya punya
   * satu implementasi.
   */
  private async replaceTemplateItems(options: {
    templateId: string;
    tenantId: string;
    items: CreatePlanningTemplateDTO["items"];
    tx: TransactionClient;
    deleteExisting: boolean;
  }): Promise<PlanningTemplateItemEntity[]> {
    const { templateId, tenantId, items, tx, deleteExisting } = options;

    if (deleteExisting) {
      await this.templateItemRepo.deleteByTemplateId(templateId, tx);
    }

    const created: PlanningTemplateItemEntity[] = [];
    for (const itemDto of items) {
      const itemInput: CreatePlanningTemplateItemInput = {
        templateId,
        tenantId,
        name: itemDto.name,
        description: itemDto.description ?? null,
        quantity: itemDto.quantity,
        unit: itemDto.unit,
        estimatedPrice: itemDto.estimatedPrice ?? null,
        notes: null,
      };

      created.push(await this.templateItemRepo.create(itemInput, tx));
    }

    return created;
  }

  /**
   * Get all templates dengan filters dan pagination
   */
  async getAll(
    filters: FindAllPlanningTemplateFilters,
  ): Promise<{ items: PlanningTemplateListItemDTO[]; total: number }> {
    const { items, total } = await this.templateRepo.findAll(filters);

    return {
      items: items.map((entity) => PlanningTemplateMapper.toDTO(entity)),
      total,
    };
  }

  /**
   * Get template by ID dengan items
   */
  async getById(
    id: string,
    tenantId: string,
  ): Promise<PlanningTemplateDetailDTO | null> {
    const entity = await this.templateRepo.findById(id);
    if (!entity || entity.tenantId !== tenantId) {
      return null;
    }

    // Load items
    const items = await this.templateItemRepo.findByTemplateId(id);

    return PlanningTemplateMapper.toDetailDTO(entity, items);
  }

  /**
   * Get active templates (isActive = true)
   */
  async getActiveTemplates(
    tenantId?: string | null,
  ): Promise<PlanningTemplateListItemDTO[]> {
    const entities = await this.templateRepo.findActive(tenantId);
    return entities.map((entity) => PlanningTemplateMapper.toDTO(entity));
  }

  /**
   * Get templates by planning type
   */
  async getByType(
    type: PlanningType,
    tenantId?: string | null,
  ): Promise<PlanningTemplateListItemDTO[]> {
    const entities = await this.templateRepo.findByType(type, tenantId);
    return entities.map((entity) => PlanningTemplateMapper.toDTO(entity));
  }

  /**
   * Create new template dengan items
   */
  async create(
    dto: CreatePlanningTemplateDTO,
    tenantId: string,
    userId: string,
  ): Promise<PlanningTemplateDetailDTO> {
    // Create template
    const createInput: CreatePlanningTemplateInput = {
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      type: dto.type,
      isActive: dto.isActive ?? true,
      createdById: userId,
    };

    // Template dan seluruh item BOQ-nya ditulis atomik. Tanpa transaksi,
    // kegagalan di tengah perulangan melahirkan template dengan BOQ separuh
    // yang tampak sah di daftar.
    const { templateEntity, itemEntities } =
      await this.unitOfWork.runInTransaction(async (tx) => {
        const created = await this.templateRepo.create(createInput, tx);

        const items = await this.replaceTemplateItems({
          templateId: created.id,
          tenantId,
          items: dto.items,
          tx,
          deleteExisting: false,
        });

        return { templateEntity: created, itemEntities: items };
      });

    // Activity log
    logger.logActivity({
      action: "planning_template.created",
      subject: "Planning Template",
      details: {
        templateId: templateEntity.id,
        name: templateEntity.name,
        type: templateEntity.type,
        itemCount: itemEntities.length,
      },
      userId,
      tenantId,
    });

    return PlanningTemplateMapper.toDetailDTO(templateEntity, itemEntities);
  }

  /**
   * Update template (dengan/tanpa items)
   */
  async update(
    id: string,
    dto: UpdatePlanningTemplateDTO,
    userId: string,
    tenantId: string,
  ): Promise<PlanningTemplateDetailDTO> {
    const existing = await this.findOwnedTemplate(id, tenantId);

    // Update template
    const updateInput: UpdatePlanningTemplateInput = {};
    if (dto.name !== undefined) updateInput.name = dto.name;
    if (dto.description !== undefined)
      updateInput.description = dto.description;
    if (dto.isActive !== undefined) updateInput.isActive = dto.isActive;

    const existingItems = await this.templateItemRepo.findByTemplateId(id);

    // Penggantian BOQ dibungkus transaksi. Ini titik paling berbahaya di
    // seluruh modul: alurnya menghapus SELURUH item lebih dulu lalu membuat
    // ulang satu per satu, sehingga kegagalan pada item ke-12 dari 40
    // meninggalkan template dengan 11 item dan 29 sisanya lenyap permanen —
    // tanpa rollback dan tanpa jejak audit apa pun.
    const { updatedEntity, itemEntities } =
      await this.unitOfWork.runInTransaction(async (tx) => {
        const updated = await this.templateRepo.update(id, updateInput, tx);

        if (dto.items === undefined) {
          return { updatedEntity: updated, itemEntities: existingItems };
        }

        const items = await this.replaceTemplateItems({
          templateId: id,
          tenantId: existing.tenantId,
          items: dto.items,
          tx,
          deleteExisting: true,
        });

        return { updatedEntity: updated, itemEntities: items };
      });

    // Activity log
    logger.logActivity({
      action: "planning_template.updated",
      subject: "Planning Template",
      details: {
        templateId: id,
        name: updatedEntity.name,
        itemsUpdated: dto.items !== undefined,
        itemCount: itemEntities.length,
      },
      userId,
      tenantId: existing.tenantId,
    });

    return PlanningTemplateMapper.toDetailDTO(updatedEntity, itemEntities);
  }

  /**
   * Delete template
   */
  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    const existing = await this.findOwnedTemplate(id, tenantId);

    await this.unitOfWork.runInTransaction(async (tx) => {
      // Item dihapus lebih dulu, lalu template — keduanya atomik supaya tidak
      // tersisa item yatim bila penghapusan template gagal.
      await this.templateItemRepo.deleteByTemplateId(id, tx);
      await this.templateRepo.delete(id, tx);
    });

    // Activity log
    logger.logActivity({
      action: "planning_template.deleted",
      subject: "Planning Template",
      details: {
        templateId: id,
        name: existing.name,
      },
      userId,
      tenantId: existing.tenantId,
    });
  }

  /**
   * Apply template ke planning baru
   * Create planning dengan items dari template
   */
  async applyTemplate(
    templateId: string,
    planningData: Omit<CreatePlanningDTO, "type">,
    tenantId: string,
    userId: string,
  ): Promise<PlanningDetailDTO> {
    // Daftar template selalu dibatasi tenantId sesi, jadi menerapkan template
    // milik tenant lain bukan alur sah mana pun. Untuk pengguna tenant biasa
    // ekstensi isolasi Prisma sudah memblokirnya di lapis query; superadmin
    // sengaja tidak difilter di sana, sehingga BOQ tenant lain -- nama
    // material, kuantitas, harga satuan -- bisa tersalin masuk ke tenant
    // penerima.
    const template = await this.findOwnedTemplate(templateId, tenantId);

    if (!template.canBeUsed()) {
      throw new PlanningInvalidStateError(
        `Template "${template.name}" sedang nonaktif dan tidak bisa digunakan.`,
      );
    }

    // Load template items
    const templateItems =
      await this.templateItemRepo.findByTemplateId(templateId);

    // Calculate total estimated budget dari template items
    let totalEstimatedBudget = 0;
    for (const item of templateItems) {
      if (item.estimatedPrice !== null) {
        totalEstimatedBudget += item.estimatedPrice * item.quantity;
      }
    }

    const approvalLevel = resolveApprovalLevel(totalEstimatedBudget);

    // Rencana, jejak auditnya, dan seluruh salinan item BOQ ditulis atomik.
    // Sebelumnya ketiganya berdiri sendiri, sehingga kegagalan saat menyalin
    // item ke-N meninggalkan rencana dengan anggaran total template tapi item
    // separuh — persis kondisi yang ditandai `hasBudgetMismatch()`, permanen.
    const { planningEntity, createdItems } =
      await this.unitOfWork.runInTransaction(async (tx) => {
        const planning = await this.planningRepo.create(
          {
            tenantId,
            type: template.type,
            title: planningData.title,
            description: planningData.description ?? null,
            area: planningData.area,
            coordinates: planningData.coordinates ?? null,
            estimatedUnits: planningData.estimatedUnits,
            estimatedBudget:
              totalEstimatedBudget > 0 ? totalEstimatedBudget : null,
            approvalLevel,
            startDate: planningData.startDate
              ? new Date(planningData.startDate)
              : null,
            targetCompletionDate: planningData.targetCompletionDate
              ? new Date(planningData.targetCompletionDate)
              : null,
            createdById: userId,
          },
          tx,
        );

        await this.auditService.logChange(
          {
            planningId: planning.id,
            tenantId: planning.tenantId,
            action: "CREATED",
            performedById: userId,
            changes: {
              initial: planningData,
              approvalLevel,
              createdFromTemplate: templateId,
              templateName: template.name,
              estimatedBudget: totalEstimatedBudget,
            },
            notes: `Planning created from template "${template.name}"`,
          },
          tx,
        );

        // Salin item template menjadi PlanningItem milik planning baru.
        // Inilah alasan fitur template ada: BOQ baku ikut terbawa, bukan cuma
        // angka anggarannya.
        const items = [];
        for (const templateItem of templateItems) {
          const itemInput: CreatePlanningItemInput = {
            planningId: planning.id,
            tenantId,
            name: templateItem.name,
            description: templateItem.description,
            quantity: templateItem.quantity,
            unit: templateItem.unit,
            estimatedPrice: templateItem.estimatedPrice,
            actualPrice: null,
            notes: templateItem.notes,
          };

          items.push(await this.itemRepo.create(itemInput, tx));
        }

        return { planningEntity: planning, createdItems: items };
      });

    // Activity log
    logger.logActivity({
      action: "planning.created_from_template",
      subject: "Planning",
      details: {
        planningId: planningEntity.id,
        templateId,
        templateName: template.name,
        title: planningEntity.title,
        estimatedBudget: totalEstimatedBudget,
        approvalLevel,
        itemCount: templateItems.length,
      },
      userId,
      tenantId,
    });

    return PlanningMapper.toDetailDTO(planningEntity, {
      items: createdItems,
      milestones: [],
      documents: [],
    });
  }
}
