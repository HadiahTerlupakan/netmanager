import type { Prisma } from "@prisma/client";
import type {
  IPlanningRepository,
  FindAllPlanningFilters,
  CreatePlanningInput,
  UpdatePlanningInput,
} from "../domain/ports/IPlanningRepository";
import type { IPlanningItemRepository } from "../domain/ports/IPlanningItemRepository";
import type { IPlanningMilestoneRepository } from "../domain/ports/IPlanningMilestoneRepository";
import type { IPlanningDocumentRepository } from "../domain/ports/IPlanningDocumentRepository";
import type {
  PlanningListItemDTO,
  PlanningDetailDTO,
  CreatePlanningDTO,
  UpdatePlanningDTO,
} from "../dto/PlanningDTO";
import type { PlanningStatus } from "../domain/entities/PlanningEntity";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { PlanningAuditService } from "./PlanningAuditService";
import { logger } from "@/lib/logger";

type PrismaTransaction = Prisma.TransactionClient;

/**
 * PlanningService
 * Service utama untuk CRUD operations planning records.
 * Menggunakan PlanningAuditService untuk audit trail.
 */
export class PlanningService {
  private readonly BUDGET_THRESHOLD = 500_000_000; // Rp 500M

  constructor(
    private readonly planningRepo: IPlanningRepository,
    private readonly itemRepo: IPlanningItemRepository,
    private readonly milestoneRepo: IPlanningMilestoneRepository,
    private readonly documentRepo: IPlanningDocumentRepository,
    private readonly auditService: PlanningAuditService,
  ) {}

  /**
   * Determine approval level berdasarkan budget threshold
   */
  private determineApprovalLevel(estimatedBudget: number | null): number {
    if (!estimatedBudget) return 1;
    return estimatedBudget >= this.BUDGET_THRESHOLD ? 2 : 1;
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
   * Get planning by ID dengan relasi lengkap
   */
  async getById(id: string): Promise<PlanningDetailDTO | null> {
    const entity = await this.planningRepo.findById(id);
    if (!entity) {
      return null;
    }

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(entity, {
      items,
      milestones,
      documents,
    });
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
    const approvalLevel = this.determineApprovalLevel(
      dto.estimatedBudget ?? null,
    );

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

    const entity = await this.planningRepo.create(createInput);

    // Audit log
    await this.auditService.logChange(
      entity.id,
      "CREATED",
      userId,
      {
        initial: dto,
        approvalLevel,
      },
      null,
    );

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
  ): Promise<PlanningDetailDTO> {
    // Validasi: planning harus ada
    const existing = await this.planningRepo.findById(id);
    if (!existing) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa diedit
    if (!existing.canBeEdited()) {
      throw new Error(
        `Planning cannot be edited in status ${existing.status}. Only BACKLOG or REJECTED status can be edited.`,
      );
    }

    // Prepare update input
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

    // Update entity
    const updatedEntity = await this.planningRepo.update(id, updateInput);

    // Build changes object for audit
    const changes: Record<string, unknown> = {};
    if (dto.title !== undefined)
      changes.title = { from: existing.title, to: dto.title };
    if (dto.estimatedBudget !== undefined)
      changes.estimatedBudget = {
        from: existing.estimatedBudget,
        to: dto.estimatedBudget,
      };
    if (dto.area !== undefined)
      changes.area = { from: existing.area, to: dto.area };

    // Audit log
    await this.auditService.logChange(id, "UPDATED", userId, changes, null);

    // Activity log
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

    // Load relations
    const items = await this.itemRepo.findByPlanningId(id);
    const milestones = await this.milestoneRepo.findByPlanningId(id);
    const documents = await this.documentRepo.findByPlanningId(id);

    return PlanningMapper.toDetailDTO(updatedEntity, {
      items,
      milestones,
      documents,
    });
  }

  /**
   * Soft delete planning
   */
  async delete(id: string, userId: string): Promise<void> {
    // Validasi: planning harus ada
    const existing = await this.planningRepo.findById(id);
    if (!existing) {
      throw new Error(`Planning with ID ${id} not found`);
    }

    // Validasi: planning harus bisa dihapus (hanya BACKLOG atau REJECTED)
    if (!existing.canBeEdited()) {
      throw new Error(
        `Planning cannot be deleted in status ${existing.status}. Only BACKLOG or REJECTED status can be deleted.`,
      );
    }

    // Soft delete
    await this.planningRepo.delete(id);

    // Audit log
    await this.auditService.logChange(
      id,
      "STATUS_CHANGED",
      userId,
      {
        action: "deleted",
        deletedAt: new Date().toISOString(),
      },
      "Planning soft deleted",
    );

    // Activity log
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
