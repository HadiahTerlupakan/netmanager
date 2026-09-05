import type {
  IPlanningRepository,
  FindAllPlanningFilters,
  CreatePlanningInput,
  UpdatePlanningInput,
} from "../domain/ports/IPlanningRepository";
import type { IPlanningUnitOfWork } from "../domain/ports/IPlanningUnitOfWork";
import type { IPlanningItemRepository } from "../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "../domain/ports/IPlanningDocumentRepository";
import type {
  PlanningListItemDTO,
  PlanningDetailDTO,
  CreatePlanningDTO,
  UpdatePlanningDTO,
} from "../dto/PlanningDTO";
import type {
  PlanningEntity,
  PlanningStatus,
} from "../domain/entities/PlanningEntity";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import { resolveApprovalLevel } from "../domain/planning-business-rules";
import {
  PlanningInvalidStateError,
  PlanningNotFoundError,
} from "../errors/planning-errors";
import { logger } from "@/lib/logger";

/**
 * PlanningService
 * Service utama untuk CRUD operations planning records.
 * Menggunakan PlanningAuditService untuk audit trail.
 */
/** Field ruang lingkup rencana — terkunci begitu rencana disetujui. */
const PLANNING_SCOPE_FIELDS = [
  "title",
  "description",
  "area",
  "coordinates",
  "estimatedUnits",
  "estimatedBudget",
  "targetCompletionDate",
] as const;

export class PlanningService {
  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly milestoneRepo: IPlanningMilestoneRepository,
    private readonly documentRepo: IPlanningDocumentRepository,
    private readonly auditService: PlanningAuditService,
    private readonly unitOfWork: IPlanningUnitOfWork,
  ) {}

  /**
   * Mengambil rencana milik tenant pemanggil, atau melempar bila tidak ada.
   *
   * Isolasi tenant modul ini sepenuhnya bersandar pada ekstensi Prisma, yang
   * **sengaja tidak memfilter super admin**. Guard eksplisit seperti ini sudah
   * ada di `PlanningTemplateService.applyTemplate` tetapi tidak dirambatkan ke
   * jalur lain, sehingga sesi super admin di panel tenant A masih bisa
   * menyetujui atau menghapus rencana tenant B hanya dengan menebak ID-nya.
   *
   * Pesan "tidak ditemukan" dipakai juga untuk kasus beda tenant supaya
   * keberadaan rencana milik tenant lain tidak terkonfirmasi lewat perbedaan
   * respons.
   */
  private async findOwnedPlanning(
    id: string,
    tenantId: string,
  ): Promise<PlanningEntity> {
    const entity = await this.planningRepo.findById(id);

    if (!entity || entity.tenantId !== tenantId) {
      throw new PlanningNotFoundError();
    }

    return entity;
  }

  /** Memuat seluruh relasi rencana secara paralel. */
  private async loadRelations(planningId: string) {
    const [items, milestones, documents] = await Promise.all([
      this.itemRepo.findByPlanningId(planningId),
      this.milestoneRepo.findByPlanningId(planningId),
      this.documentRepo.findByPlanningId(planningId),
    ]);

    return { items, milestones, documents };
  }

  /**
   * Get all plannings dengan filters dan pagination
   */
  async getAll(
    filters: FindAllPlanningFilters,
  ): Promise<{ items: PlanningListItemDTO[]; total: number }> {
    const { items, total } = await this.planningRepo.findAll(filters);

    return {
      items: items.map((entity) => PlanningMapper.toDTO(entity)),
      total,
    };
  }

  /**
   * Get planning by ID dengan relasi lengkap.
   * Mengembalikan null bila rencana tidak ada atau bukan milik tenant ini.
   */
  async getById(
    id: string,
    tenantId: string,
  ): Promise<PlanningDetailDTO | null> {
    const entity = await this.planningRepo.findById(id);
    if (!entity || entity.tenantId !== tenantId) {
      return null;
    }

    return PlanningMapper.toDetailDTO(entity, await this.loadRelations(id));
  }

  /**
   * Get plannings by status
   */
  async getByStatus(
    status: PlanningStatus,
    tenantId?: string | null,
  ): Promise<PlanningListItemDTO[]> {
    const entities = await this.planningRepo.findByStatus(status, tenantId);
    return entities.map((entity) => PlanningMapper.toDTO(entity));
  }

  /**
   * Get plannings pending approval (PENDING_APPROVAL atau APPROVED_LEVEL1)
   */
  async getPendingApproval(
    tenantId?: string | null,
  ): Promise<PlanningListItemDTO[]> {
    const entities = await this.planningRepo.findPendingApproval(tenantId);
    return entities.map((entity) => PlanningMapper.toDTO(entity));
  }

  /**
   * Get plannings created by specific user
   */
  async getByCreatedBy(
    userId: string,
    tenantId?: string | null,
  ): Promise<PlanningListItemDTO[]> {
    const entities = await this.planningRepo.findByCreatedBy(userId, tenantId);
    return entities.map((entity) => PlanningMapper.toDTO(entity));
  }

  /**
   * Create new planning
   */
  async create(
    dto: CreatePlanningDTO,
    tenantId: string,
    userId: string,
  ): Promise<PlanningDetailDTO> {
    // Determine approval level based on budget
    const approvalLevel = resolveApprovalLevel(dto.estimatedBudget ?? null);

    // Create planning entity
    const createInput: CreatePlanningInput = {
      tenantId,
      type: dto.type,
      title: dto.title,
      description: dto.description ?? null,
      area: dto.area,
      coordinates: dto.coordinates ?? null,
      estimatedUnits: dto.estimatedUnits,
      estimatedBudget: dto.estimatedBudget ?? null,
      approvalLevel,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      targetCompletionDate: dto.targetCompletionDate
        ? new Date(dto.targetCompletionDate)
        : null,
      createdById: userId,
    };

    // Rencana dan jejak auditnya ditulis atomik. Tanpa transaksi, kegagalan
    // pada audit meninggalkan rencana yang tercipta tetapi tidak tercatat,
    // sementara API tetap membalas error — pengguna mengulang dan menumpuk
    // rencana duplikat.
    const entity = await this.unitOfWork.runInTransaction(async (tx) => {
      const created = await this.planningRepo.create(createInput, tx);

      await this.auditService.logChange(
        {
          planningId: created.id,
          tenantId: created.tenantId,
          action: "CREATED",
          performedById: userId,
          changes: { initial: dto, approvalLevel },
        },
        tx,
      );

      return created;
    });

    // Activity log
    logger.logActivity({
      action: "planning.created",
      subject: "Planning",
      details: {
        planningId: entity.id,
        title: entity.title,
        type: entity.type,
        estimatedBudget: entity.estimatedBudget,
        approvalLevel,
      },
      userId,
      tenantId,
    });

    // Return DTO dengan relasi kosong (baru dibuat)
    return PlanningMapper.toDetailDTO(entity, {
      items: [],
      milestones: [],
      documents: [],
    });
  }

  /**
   * Update planning data
   */
  async update(
    id: string,
    dto: UpdatePlanningDTO,
    userId: string,
    tenantId: string,
  ): Promise<PlanningDetailDTO> {
    const existing = await this.findOwnedPlanning(id, tenantId);

    // Dua jendela perubahan yang berbeda, sengaja dipisah:
    // - Field PERENCANAAN terkunci setelah disetujui; mengubah ruang lingkup
    //   atau estimasi rencana yang sudah disetujui membatalkan makna
    //   persetujuan itu.
    // - Field REALISASI justru baru ada setelah pekerjaan berjalan. Sebelumnya
    //   keduanya memakai gerbang `canBeEdited()` yang sama, sehingga realisasi
    //   hanya bisa diisi saat BACKLOG — ketika realisasi belum ada — lalu
    //   terkunci selamanya begitu disetujui.
    const isRecordingExecution = existing.canRecordExecutionProgress();
    const hasPlanningFieldChange = PLANNING_SCOPE_FIELDS.some(
      (field) => dto[field] !== undefined,
    );

    if (!existing.canBeEdited() && !isRecordingExecution) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${existing.status} tidak bisa diubah. Hanya rencana berstatus BACKLOG atau REJECTED yang bisa diubah.`,
      );
    }

    if (isRecordingExecution && hasPlanningFieldChange) {
      throw new PlanningInvalidStateError(
        `Ruang lingkup rencana tidak bisa diubah saat berstatus ${existing.status}. Yang bisa dicatat hanya realisasi pelaksanaan.`,
      );
    }

    const updateInput = this.buildUpdateInput(dto);
    const changes = this.buildAuditChanges(existing, dto);

    const updatedEntity = await this.unitOfWork.runInTransaction(async (tx) => {
      const updated = await this.planningRepo.update(id, updateInput, tx);

      await this.auditService.logChange(
        {
          planningId: id,
          tenantId: existing.tenantId,
          action: "UPDATED",
          performedById: userId,
          changes,
        },
        tx,
      );

      return updated;
    });

    logger.logActivity({
      action: "planning.updated",
      subject: "Planning",
      details: {
        planningId: id,
        changes: Object.keys(changes),
      },
      userId,
      tenantId: existing.tenantId,
    });

    return PlanningMapper.toDetailDTO(
      updatedEntity,
      await this.loadRelations(id),
    );
  }

  /** Menerjemahkan DTO update menjadi input repository. */
  private buildUpdateInput(dto: UpdatePlanningDTO): UpdatePlanningInput {
    const updateInput: UpdatePlanningInput = {};

    if (dto.title !== undefined) updateInput.title = dto.title;
    if (dto.description !== undefined)
      updateInput.description = dto.description;
    if (dto.area !== undefined) updateInput.area = dto.area;
    if (dto.coordinates !== undefined)
      updateInput.coordinates = dto.coordinates;
    if (dto.estimatedUnits !== undefined)
      updateInput.estimatedUnits = dto.estimatedUnits;
    if (dto.estimatedBudget !== undefined)
      updateInput.estimatedBudget = dto.estimatedBudget;
    if (dto.actualBudget !== undefined)
      updateInput.actualBudget = dto.actualBudget;
    if (dto.progressPercentage !== undefined)
      updateInput.progressPercentage = dto.progressPercentage;
    if (dto.startDate !== undefined)
      updateInput.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.targetCompletionDate !== undefined)
      updateInput.targetCompletionDate = dto.targetCompletionDate
        ? new Date(dto.targetCompletionDate)
        : null;

    return updateInput;
  }

  /**
   * Menyusun catatan perubahan untuk audit.
   *
   * Merekam SETIAP field yang berubah. Sebelumnya hanya `title`,
   * `estimatedBudget`, dan `area` yang dicatat, sehingga perubahan pada
   * `estimatedUnits`, `coordinates`, `targetCompletionDate`, `actualBudget`,
   * dan `progressPercentage` menghasilkan entri audit `UPDATED` dengan
   * `changes: {}` — nol informasi tentang apa yang sebenarnya berubah.
   */
  private buildAuditChanges(
    existing: PlanningEntity,
    dto: UpdatePlanningDTO,
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {};

    const record = <K extends keyof UpdatePlanningDTO>(
      field: K,
      from: unknown,
    ) => {
      if (dto[field] === undefined) {
        return;
      }
      changes[field as string] = { from, to: dto[field] };
    };

    record("title", existing.title);
    record("description", existing.description);
    record("area", existing.area);
    record("coordinates", existing.coordinates);
    record("estimatedUnits", existing.estimatedUnits);
    record("estimatedBudget", existing.estimatedBudget);
    record("actualBudget", existing.actualBudget);
    record("progressPercentage", existing.progressPercentage);
    record("startDate", existing.startDate?.toISOString() ?? null);
    record(
      "targetCompletionDate",
      existing.targetCompletionDate?.toISOString() ?? null,
    );

    return changes;
  }

  /**
   * Soft delete planning
   */
  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    const existing = await this.findOwnedPlanning(id, tenantId);

    // Validasi: planning harus bisa dihapus (hanya BACKLOG atau REJECTED)
    if (!existing.canBeEdited()) {
      throw new PlanningInvalidStateError(
        `Rencana berstatus ${existing.status} tidak bisa dihapus. Hanya rencana berstatus BACKLOG atau REJECTED yang bisa dihapus.`,
      );
    }

    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.planningRepo.delete(id, tx);

      await this.auditService.logChange(
        {
          planningId: id,
          tenantId: existing.tenantId,
          action: "STATUS_CHANGED",
          performedById: userId,
          changes: {
            action: "deleted",
            deletedAt: new Date().toISOString(),
          },
          notes: "Planning soft deleted",
        },
        tx,
      );
    });

    logger.logActivity({
      action: "planning.deleted",
      subject: "Planning",
      details: {
        planningId: id,
        title: existing.title,
      },
      userId,
      tenantId: existing.tenantId,
    });
  }
}
