import type { Prisma } from "@prisma/client";
import type {
  PlanningTemplateEntity,
  PlanningType,
} from "../entities/PlanningTemplateEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningTemplateInput {
  tenantId: string;
  name: string;
  description?: string | null;
  type: PlanningType;
  isActive?: boolean;
  createdById?: string | null;
}

export interface UpdatePlanningTemplateInput {
  name?: string;
  description?: string | null;
  type?: PlanningType;
  isActive?: boolean;
}

export interface FindAllPlanningTemplateFilters {
  tenantId?: string | null;
  type?: PlanningType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface IPlanningTemplateRepository {
  /**
   * Find planning template by ID
   */
  findById(id: string): Promise<PlanningTemplateEntity | null>;

  /**
   * Find all planning templates with filters and pagination
   */
  findAll(
    filters: FindAllPlanningTemplateFilters,
  ): Promise<{ items: PlanningTemplateEntity[]; total: number }>;

  /**
   * Find all active templates (isActive = true)
   */
  findActive(tenantId?: string | null): Promise<PlanningTemplateEntity[]>;

  /**
   * Find templates by planning type
   */
  findByType(
    type: PlanningType,
    tenantId?: string | null,
  ): Promise<PlanningTemplateEntity[]>;

  /**
   * Create new planning template
   */
  create(
    data: CreatePlanningTemplateInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningTemplateEntity>;

  /**
   * Update planning template
   */
  update(
    id: string,
    data: UpdatePlanningTemplateInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningTemplateEntity>;

  /**
   * Delete planning template
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
