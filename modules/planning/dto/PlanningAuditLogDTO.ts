import type { AuditAction } from "../domain/entities/PlanningAuditLogEntity";

/**
 * DTO for Planning Audit Log
 */
export interface PlanningAuditLogDTO {
  id: string;
  planningId: string;
  action: AuditAction;
  performedById: string | null;
  performedAt: string;
  changes: Record<string, unknown> | null;
  notes: string | null;
  isCriticalAction: boolean;
  isSystemAction: boolean;
}

/**
 * DTO for creating Planning Audit Log
 */
export interface CreatePlanningAuditLogDTO {
  action: AuditAction;
  performedById?: string;
  changes?: Record<string, unknown>;
  notes?: string;
}
