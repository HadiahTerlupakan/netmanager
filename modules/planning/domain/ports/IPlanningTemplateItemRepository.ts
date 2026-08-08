import type { Prisma } from "@prisma/client";
import type { PlanningTemplateItemEntity } from "../entities/PlanningTemplateItemEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningTemplateItemInput {
  templateId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimatedPrice?: number | null;
  notes?: string | null;
}

export interface UpdatePlanningTemplateItemInput {
  name?: string;
  description?: string | null;
  quantity?: number;
  unit?: string;
  estimatedPrice?: number | null;
  notes?: string | null;
}

export interface FindAllPlanningTemplateItemFilters {
  tenantId?: string | null;
  templateId?: string;
  page?: number;
  limit?: number;
}

export interface IPlanningTemplateItemRepository {
  /**
   * Find planning template item by ID
   */
  findById(id: string): Promise<PlanningTemplateItemEntity | null>;

  /**
   * Find all planning template items with filters and pagination
   */
  findAll(
    filters: FindAllPlanningTemplateItemFilters,
  ): Promise<{ items: PlanningTemplateItemEntity[]; total: number }>;

  /**
   * Find all items for a specific template
   */
  findByTemplateId(templateId: string): Promise<PlanningTemplateItemEntity[]>;

  /**
   * Create new planning template item
   */
  create(
    data: CreatePlanningTemplateItemInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningTemplateItemEntity>;

  /**
   * Update planning template item
   */
  update(
    id: string,
    data: UpdatePlanningTemplateItemInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningTemplateItemEntity>;

  /**
   * Delete planning template item
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;

  /**
   * Delete all items for a specific template (cascade delete)
   */
  deleteByTemplateId(templateId: string, tx?: PrismaTransaction): Promise<void>;
}
