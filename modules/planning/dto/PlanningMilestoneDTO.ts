import type { MilestoneStatus } from "../domain/entities/PlanningMilestoneEntity";

/**
 * PlanningMilestoneDTO - Standard milestone representation for API responses
 */
export interface PlanningMilestoneDTO {
  id: string;
  planningId: string;
  name: string;
  description: string | null;
  targetDate: string;
  actualDate: string | null;
  status: MilestoneStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  // Computed fields
  isOverdue: boolean;
  daysRemaining: number;
}

/**
 * UpdatePlanningMilestoneDTO - Request payload for updating milestone
 * Supports both single and bulk updates
 */
export interface UpdatePlanningMilestoneDTO {
  status?: MilestoneStatus;
  actualDate?: string | null;
  notes?: string | null;
}
