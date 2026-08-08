import type { Prisma } from "@prisma/client";
import type { PlanningItemEntity } from "../entities/PlanningItemEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningItemInput {
  planningId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  estimatedPrice?: number | null;
  actualPrice?: number | null;
  notes?: string | null;
}

export interface UpdatePlanningItemInput {
  name?: string;
  description?: string | null;
  quantity?: number;
  unit?: string;
  estimatedPrice?: number | null;
  actualPrice?: number | null;
  notes?: string | null;
}

export interface FindAllPlanningItemFilters {
  tenantId?: string | null;
  planningId?: string;
  page?: number;
  limit?: number;
}

export interface IPlanningItemRepository {
  /**
   * Find planning item by ID
   */
  findById(id: string): Promise<PlanningItemEntity | null>;

  /**
   * Find all planning items with filters and pagination
   */
  findAll(
    filters: FindAllPlanningItemFilters,
  ): Promise<{ items: PlanningItemEntity[]; total: number }>;

  /**
   * Find all items for a specific planning
   */
  findByPlanningId(planningId: string): Promise<PlanningItemEntity[]>;

  /**
   * Get total estimated budget for a planning (sum of all items' estimatedPrice * quantity)
   */
  getTotalEstimatedBudget(planningId: string): Promise<number>;

  /**
   * Create new planning item
   */
  create(
    data: CreatePlanningItemInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningItemEntity>;

  /**
   * Update planning item
   */
  update(
    id: string,
    data: UpdatePlanningItemInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningItemEntity>;

  /**
   * Delete planning item
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;

  /**
   * Delete all items for a specific planning (cascade delete)
   */
  deleteByPlanningId(planningId: string, tx?: PrismaTransaction): Promise<void>;
}
