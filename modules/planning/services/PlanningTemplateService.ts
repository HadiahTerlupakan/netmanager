import type { Prisma } from "@prisma/client";
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
  PlanningTemplateListItemDTO,
  PlanningTemplateDetailDTO,
  CreatePlanningTemplateDTO,
  UpdatePlanningTemplateDTO,
  PlanningTemplateItemDTO,
} from "../dto/PlanningTemplateDTO";
import type { CreatePlanningDTO, PlanningDetailDTO } from "../dto/PlanningDTO";
import type { PlanningType } from "../domain/entities/PlanningEntity";
import { PlanningTemplateMapper } from "../mappers/PlanningTemplateMapper";
import { PlanningTemplateItemMapper } from "../mappers/PlanningTemplateItemMapper";
import { PlanningMapper } from "../mappers/PlanningMapper";
import { logger } from "@/lib/logger";

type PrismaTransaction = Prisma.TransactionClient;

/**
 * PlanningTemplateService
 * Service untuk mengelola template planning dan apply template ke planning baru.
 */
export class PlanningTemplateService {
  constructor(
    private readonly templateRepo: IPlanningTemplateRepository,
    private readonly templateItemRepo: IPlanningTemplateItemRepository,
    private readonly planningRepo: IPlanningRepository,
  ) {}

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
  async getById(id: string): Promise<PlanningTemplateDetailDTO | null> {
    const entity = await this.templateRepo.findById(id);
    if (!entity) {
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

    const templateEntity = await this.templateRepo.create(createInput);

    // Create template items
    const itemEntities = [];
    for (const itemDto of dto.items) {
      const itemInput: CreatePlanningTemplateItemInput = {
        templateId: templateEntity.id,
        tenantId,
        name: itemDto.name,
        description: itemDto.description ?? null,
        quantity: itemDto.quantity,
        unit: itemDto.unit,
        estimatedPrice: itemDto.estimatedPrice ?? null,
        notes: null,
      };

      const itemEntity = await this.templateItemRepo.create(itemInput);
      itemEntities.push(itemEntity);
    }

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
  ): Promise<PlanningTemplateDetailDTO> {
    // Validasi: template harus ada
    const existing = await this.templateRepo.findById(id);
    if (!existing) {
      throw new Error(`Planning template with ID ${id} not found`);
    }

    // Update template
    const updateInput: UpdatePlanningTemplateInput = {};
    if (dto.name !== undefined) updateInput.name = dto.name;
    if (dto.description !== undefined)
      updateInput.description = dto.description;
    if (dto.isActive !== undefined) updateInput.isActive = dto.isActive;

    const updatedEntity = await this.templateRepo.update(id, updateInput);

    // Update items jika disediakan
    let itemEntities = await this.templateItemRepo.findByTemplateId(id);
    if (dto.items !== undefined) {
      // Delete existing items
      await this.templateItemRepo.deleteByTemplateId(id);

      // Create new items
      itemEntities = [];
      for (const itemDto of dto.items) {
        const itemInput: CreatePlanningTemplateItemInput = {
          templateId: id,
          tenantId: existing.tenantId,
          name: itemDto.name,
          description: itemDto.description ?? null,
          quantity: itemDto.quantity,
          unit: itemDto.unit,
          estimatedPrice: itemDto.estimatedPrice ?? null,
          notes: null,
        };

        const itemEntity = await this.templateItemRepo.create(itemInput);
        itemEntities.push(itemEntity);
      }
    }

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
  async delete(id: string, userId: string): Promise<void> {
    // Validasi: template harus ada
    const existing = await this.templateRepo.findById(id);
    if (!existing) {
      throw new Error(`Planning template with ID ${id} not found`);
    }

    // Delete items first
    await this.templateItemRepo.deleteByTemplateId(id);

    // Delete template
    await this.templateRepo.delete(id);

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
    // Validasi: template harus ada dan active
    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new Error(`Planning template with ID ${templateId} not found`);
    }

    if (!template.canBeUsed()) {
      throw new Error(
        `Planning template ${templateId} is inactive and cannot be used`,
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

    // Determine approval level based on total budget
    const approvalLevel = totalEstimatedBudget >= 500_000_000 ? 2 : 1; // 500M threshold

    // Create planning
    const planningEntity = await this.planningRepo.create({
      tenantId,
      type: template.type,
      title: planningData.title,
      description: planningData.description ?? null,
      area: planningData.area,
      coordinates: planningData.coordinates ?? null,
      estimatedUnits: planningData.estimatedUnits,
      estimatedBudget: totalEstimatedBudget > 0 ? totalEstimatedBudget : null,
      approvalLevel,
      startDate: planningData.startDate
        ? new Date(planningData.startDate)
        : null,
      targetCompletionDate: planningData.targetCompletionDate
        ? new Date(planningData.targetCompletionDate)
        : null,
      createdById: userId,
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

    // Return planning DTO dengan items dari template
    const itemDTOs: PlanningTemplateItemDTO[] = templateItems.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      estimatedPrice: item.estimatedPrice,
    }));

    return PlanningMapper.toDetailDTO(planningEntity, {
      items: [], // Items belum di-create di PlanningItem table
      milestones: [],
      documents: [],
    });
  }
}
