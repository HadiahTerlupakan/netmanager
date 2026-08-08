import type { Prisma } from "@prisma/client";
import type {
  PlanningAuditLogEntity,
  AuditAction,
} from "../entities/PlanningAuditLogEntity";

type PrismaTransaction = Prisma.TransactionClient;

export interface CreatePlanningAuditLogInput {
  planningId: string;
  tenantId: string;
  action: AuditAction;
  performedById?: string | null;
  changes?: Record<string, unknown> | null;
  notes?: string | null;
}

export interface FindAuditLogFilters {
  tenantId?: string | null;
  action?: AuditAction;
  performedById?: string | null;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IPlanningAuditLogRepository {
  /**
   * Find audit log entry by ID
   */
  findById(id: string): Promise<PlanningAuditLogEntity | null>;

  /**
   * Find all audit logs for a specific planning with optional filters
   */
  findByPlanningId(
    planningId: string,
    filters?: FindAuditLogFilters,
  ): Promise<{ items: PlanningAuditLogEntity[]; total: number }>;

  /**
   * Find audit logs by specific action for a planning
   */
  findByAction(
    planningId: string,
    action: AuditAction,
  ): Promise<PlanningAuditLogEntity[]>;

  /**
   * Create new audit log entry
   * Note: Audit logs are append-only, no update or delete methods
   */
  create(
    data: CreatePlanningAuditLogInput,
    tx?: PrismaTransaction,
  ): Promise<PlanningAuditLogEntity>;
}
