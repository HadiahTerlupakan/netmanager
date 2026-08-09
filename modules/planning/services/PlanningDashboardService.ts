import type { IPlanningRepository } from "../domain/ports/IPlanningRepository";
import type { PlanningDashboardDTO } from "../dto/PlanningDashboardDTO";
import type {
  PlanningEntity,
  PlanningStatus,
} from "../domain/entities/PlanningEntity";
import { PlanningDashboardMapper } from "../mappers/PlanningDashboardMapper";

export interface DashboardFilters {
  startDate?: Date;
  endDate?: Date;
}

/**
 * PlanningDashboardService
 * Service untuk dashboard metrics dan analytics
 * Read-only service dengan aggregation logic
 */
export class PlanningDashboardService {
  constructor(private readonly planningRepository: IPlanningRepository) {}

  /**
   * Get dashboard metrics dengan status distribution, budget summary, dan timeline stats
   */
  async getDashboard(
    tenantId: string | null,
    filters?: DashboardFilters,
  ): Promise<PlanningDashboardDTO> {
    // Fetch all plannings untuk aggregation
    const { items: plannings } = await this.planningRepository.findAll({
      tenantId,
      page: 1,
      limit: 10000, // Dashboard aggregates all data
    });

    // Filter by date range jika ada
    let filteredPlannings = plannings;
    if (filters?.startDate || filters?.endDate) {
      filteredPlannings = plannings.filter((p) => {
        if (filters.startDate && p.createdAt < filters.startDate) {
          return false;
        }
        if (filters.endDate && p.createdAt > filters.endDate) {
          return false;
        }
        return true;
      });
    }

    // Calculate status distribution
    const statusData = this.calculateStatusCounts(filteredPlannings);

    // Prepare budget data
    const budgetData = filteredPlannings.map((p) => ({
      estimatedBudget: p.estimatedBudget,
      actualBudget: p.actualBudget,
    }));

    // Prepare timeline data
    const timelineData = filteredPlannings.map((p) => ({
      status: p.status,
      targetCompletionDate: p.targetCompletionDate,
      actualCompletionDate: p.actualCompletionDate,
      startDate: p.startDate,
    }));

    // Get recent plannings (last 10 updated)
    const recentPlannings = [...filteredPlannings]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        updatedAt: p.updatedAt,
      }));

    // Map to DTO using mapper
    return PlanningDashboardMapper.toDashboardDTO(
      statusData,
      budgetData,
      timelineData,
      recentPlannings,
    );
  }

  /**
   * Calculate count per status
   */
  private calculateStatusCounts(
    plannings: PlanningEntity[],
  ): Array<{ status: PlanningStatus; _count: number }> {
    const counts = new Map<PlanningStatus, number>();

    // Initialize all statuses with 0
    const allStatuses: PlanningStatus[] = [
      "BACKLOG",
      "PENDING_APPROVAL",
      "APPROVED_LEVEL1",
      "APPROVED",
      "IN_PROGRESS",
      "COMPLETED",
      "REJECTED",
      "CANCELLED",
    ];

    allStatuses.forEach((status) => counts.set(status, 0));

    // Count plannings per status
    plannings.forEach((p) => {
      counts.set(p.status, (counts.get(p.status) || 0) + 1);
    });

    // Convert to array format expected by mapper
    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      _count: count,
    }));
  }
}
