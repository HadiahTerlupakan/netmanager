import type { Prisma } from "@prisma/client";
import type {
  PlanningEntity,
  PlanningStatus,
  PlanningType,
  Coordinates,
} from "../entities/PlanningEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningInput {
  tenantId: string;
  type: PlanningType;
  title: string;
  description?: string | null;
  area: string;
  coordinates?: Coordinates | null;
  estimatedUnits: number;
  estimatedBudget?: number | null;
  approvalLevel: number;
  startDate?: Date | null;
  targetCompletionDate?: Date | null;
  createdById?: string | null;
}

export interface UpdatePlanningInput {
  title?: string;
  description?: string | null;
  area?: string;
  coordinates?: Coordinates | null;
  estimatedUnits?: number;
  estimatedBudget?: number | null;
  actualBudget?: number | null;
  progressPercentage?: number;
  startDate?: Date | null;
  targetCompletionDate?: Date | null;
  actualCompletionDate?: Date | null;
}

export interface UpdateStatusInput {
  status: PlanningStatus;
  currentApprovalStep?: number;
  approvalLevel?: number;
  submittedAt?: Date | null;
  submittedById?: string | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
  approvedLevel1At?: Date | null;
  approvedLevel1ById?: string | null;
  rejectedAt?: Date | null;
  rejectedById?: string | null;
  approvalNotes?: string | null;
}

export interface FindAllPlanningFilters {
  tenantId?: string | null;
  type?: PlanningType;
  status?: PlanningStatus;
  search?: string;
  createdById?: string | null;
  area?: string;
  page?: number;
  limit?: number;
}

export interface IPlanningRepository {
  /**
   * Find planning by ID
   */
  findById(id: string): Promise<PlanningEntity | null>;

  /**
   * Find all plannings with filters and pagination
   */
  findAll(
    filters: FindAllPlanningFilters,
  ): Promise<{ items: PlanningEntity[]; total: number }>;

  /**
   * Find plannings by status
   */
  findByStatus(
    status: PlanningStatus,
    tenantId?: string | null,
  ): Promise<PlanningEntity[]>;

  /**
   * Find plannings pending approval (PENDING_APPROVAL or APPROVED_LEVEL1)
   */
  findPendingApproval(tenantId?: string | null): Promise<PlanningEntity[]>;

  /**
   * Find plannings created by specific user
   */
  findByCreatedBy(
    userId: string,
    tenantId?: string | null,
  ): Promise<PlanningEntity[]>;

  /**
   * Create new planning
   */
  create(
    data: CreatePlanningInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningEntity>;

  /**
   * Update planning data
   */
  update(
    id: string,
    data: UpdatePlanningInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningEntity>;

  /**
   * Update planning status and related approval fields
   */
  updateStatus(
    id: string,
    updates: UpdateStatusInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningEntity>;

  /**
   * Soft delete planning (set deletedAt)
   */
  delete(id: string, tx?: PrismaTransaction): Promise<void>;
}
