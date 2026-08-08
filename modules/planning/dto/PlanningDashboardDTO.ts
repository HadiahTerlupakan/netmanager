import type { PlanningStatus } from "../domain/entities/PlanningEntity";

/**
 * PlanningStatusDistribution - Breakdown of planning records by status
 */
export interface PlanningStatusDistribution {
  status: PlanningStatus;
  count: number;
  percentage: number;
}

/**
 * PlanningBudgetSummary - Budget statistics across all planning records
 */
export interface PlanningBudgetSummary {
  totalEstimatedBudget: number;
  totalActualBudget: number;
  variance: number;
  variancePercentage: number;
  overBudgetCount: number;
  underBudgetCount: number;
}

/**
 * PlanningTimelineStats - Timeline and progress statistics
 */
export interface PlanningTimelineStats {
  totalPlanning: number;
  completedOnTime: number;
  completedLate: number;
  inProgressOnTrack: number;
  inProgressOverdue: number;
  averageCompletionDays: number | null;
}

/**
 * PlanningDashboardDTO - Aggregated dashboard metrics
 * Combines status distribution, budget summary, and timeline stats
 */
export interface PlanningDashboardDTO {
  statusDistribution: PlanningStatusDistribution[];
  budgetSummary: PlanningBudgetSummary;
  timelineStats: PlanningTimelineStats;
  recentPlanning: {
    id: string;
    title: string;
    status: PlanningStatus;
    updatedAt: string;
  }[];
}
