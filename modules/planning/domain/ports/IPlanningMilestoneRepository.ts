import type { Prisma } from "@prisma/client";
import type {
  PlanningMilestoneEntity,
  MilestoneStatus,
} from "../entities/PlanningMilestoneEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningMilestoneInput {
  planningId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  targetDate: Date;
  status?: MilestoneStatus;
  notes?: string | null;
}

export interface UpdatePlanningMilestoneInput {
  name?: string;
  description?: string | null;
  targetDate?: Date;
  actualDate?: Date | null;
  status?: MilestoneStatus;
  notes?: string | null;
}

export interface FindAllPlanningMilestoneFilters {
  tenantId?: string | null;
  planningId?: string;
  status?: MilestoneStatus;
  page?: number;
  limit?: number;
}

export interface IPlanningMilestoneRepository {
  /**
   * Find planning milestone by ID
   */
  findById(id: string): Promise<PlanningMilestoneEntity | null>;

  /**
   * Find all planning milestones with filters and pagination
   */
  findAll(
    filters: FindAllPlanningMilestoneFilters,
  ): Promise<{ items: PlanningMilestoneEntity[]; total: number }>;

  /**
   * Find all milestones for a specific planning
   */
  findByPlanningId(planningId: string): Promise<PlanningMilestoneEntity[]>;

  /**
   * Find milestones by status for a specific planning
   */
  findByStatus(
    planningId: string,
    status: MilestoneStatus,
  ): Promise<PlanningMilestoneEntity[]>;

  /**
   * Create new planning milestone
   */
  create(
    data: CreatePlanningMilestoneInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningMilestoneEntity>;

  /**
   * Update planning milestone
   */
  update(
    id: string,
    data: UpdatePlanningMilestoneInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningMilestoneEntity>;

  /**
   * Update milestone status and optionally set actual completion date
   */
  updateStatus(
    id: string,
    status: MilestoneStatus,
    actualDate?: Date,
    tx?: PrismaTransaction,
  ): Promise<PlanningMilestoneEntity>;

  /**
   * Delete planning milestone
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
