import type {
  PlanningDashboardDTO,
  PlanningStatusDistribution,
  PlanningBudgetSummary,
  PlanningTimelineStats,
} from "../dto/PlanningDashboardDTO";
import type {
  PlanningKanbanBoardDTO,
  PlanningKanbanColumnDTO,
  PlanningKanbanCardDTO,
} from "../dto/PlanningKanbanDTO";
import type {
  PlanningStatus,
  PlanningEntity,
} from "../domain/entities/PlanningEntity";

interface StatusCount {
  status: PlanningStatus;
  _count: number;
}

interface BudgetData {
  estimatedBudget: number | null;
  actualBudget: number | null;
}

interface TimelineData {
  status: PlanningStatus;
  targetCompletionDate: Date | null;
  actualCompletionDate: Date | null;
  startDate: Date | null;
}

interface RecentPlanningData {
  id: string;
  title: string;
  status: PlanningStatus;
  updatedAt: Date;
}

export class PlanningDashboardMapper {
  /**
   * Convert status count data to status distribution DTO
   */
  static toStatusDistribution(
    data: StatusCount[],
  ): PlanningStatusDistribution[] {
    const total = data.reduce((sum, item) => sum + item._count, 0);

    return data.map((item) => ({
      status: item.status,
      count: item._count,
      percentage: total > 0 ? (item._count / total) * 100 : 0,
    }));
  }

  /**
   * Convert budget data to budget summary DTO
   */
  static toBudgetSummary(data: BudgetData[]): PlanningBudgetSummary {
    let totalEstimatedBudget = 0;
    let totalActualBudget = 0;
    let overBudgetCount = 0;
    let underBudgetCount = 0;

    data.forEach((item) => {
      if (item.estimatedBudget !== null) {
        totalEstimatedBudget += item.estimatedBudget;
      }
      if (item.actualBudget !== null) {
        totalActualBudget += item.actualBudget;

        if (item.estimatedBudget !== null) {
          if (item.actualBudget > item.estimatedBudget) {
            overBudgetCount++;
          } else if (item.actualBudget < item.estimatedBudget) {
            underBudgetCount++;
          }
        }
      }
    });

    const variance = totalActualBudget - totalEstimatedBudget;
    const variancePercentage =
      totalEstimatedBudget > 0 ? (variance / totalEstimatedBudget) * 100 : 0;

    return {
      totalEstimatedBudget,
      totalActualBudget,
      variance,
      variancePercentage,
      overBudgetCount,
      underBudgetCount,
    };
  }

  /**
   * Convert timeline data to timeline stats DTO
   */
  static toTimelineStats(data: TimelineData[]): PlanningTimelineStats {
    const totalPlanning = data.length;
    let completedOnTime = 0;
    let completedLate = 0;
    let inProgressOnTrack = 0;
    let inProgressOverdue = 0;
    let totalCompletionDays = 0;
    let completedCount = 0;

    const now = new Date();

    data.forEach((item) => {
      if (item.status === "COMPLETED" && item.actualCompletionDate) {
        completedCount++;

        if (item.startDate) {
          const completionDays = Math.round(
            (item.actualCompletionDate.getTime() - item.startDate.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          totalCompletionDays += completionDays;
        }

        if (
          item.targetCompletionDate &&
          item.actualCompletionDate <= item.targetCompletionDate
        ) {
          completedOnTime++;
        } else {
          completedLate++;
        }
      } else if (item.status === "IN_PROGRESS") {
        if (item.targetCompletionDate && now > item.targetCompletionDate) {
          inProgressOverdue++;
        } else {
          inProgressOnTrack++;
        }
      }
    });

    return {
      totalPlanning,
      completedOnTime,
      completedLate,
      inProgressOnTrack,
      inProgressOverdue,
      averageCompletionDays:
        completedCount > 0 ? totalCompletionDays / completedCount : null,
    };
  }

  /**
   * Convert aggregated data to dashboard DTO
   */
  static toDashboardDTO(
    statusData: StatusCount[],
    budgetData: BudgetData[],
    timelineData: TimelineData[],
    recentData: RecentPlanningData[],
  ): PlanningDashboardDTO {
    return {
      statusDistribution: this.toStatusDistribution(statusData),
      budgetSummary: this.toBudgetSummary(budgetData),
      timelineStats: this.toTimelineStats(timelineData),
      recentPlanning: recentData.map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Convert planning entity to kanban card DTO
   */
  static toKanbanCard(
    entity: PlanningEntity,
    itemsCount: number = 0,
    milestonesCount: number = 0,
    completedMilestonesCount: number = 0,
  ): PlanningKanbanCardDTO {
    return {
      id: entity.id,
      title: entity.title,
      area: entity.area,
      estimatedBudget: entity.estimatedBudget,
      progressPercentage: entity.progressPercentage,
      targetCompletionDate: entity.targetCompletionDate?.toISOString() ?? null,
      itemsCount,
      milestonesCount,
      completedMilestonesCount,
    };
  }

  /**
   * Convert grouped plannings to kanban board DTO
   */
  static toKanbanBoard(
    columns: Map<PlanningStatus, PlanningEntity[]>,
    countsMap?: Map<
      string,
      { items: number; milestones: number; completedMilestones: number }
    >,
  ): PlanningKanbanBoardDTO {
    const statusLabels: Record<PlanningStatus, string> = {
      BACKLOG: "Backlog",
      PENDING_APPROVAL: "Menunggu Persetujuan",
      APPROVED_LEVEL1: "Disetujui Level 1",
      APPROVED: "Disetujui",
      IN_PROGRESS: "Dalam Proses",
      COMPLETED: "Selesai",
      REJECTED: "Ditolak",
      CANCELLED: "Dibatalkan",
    };

    const columnOrder: PlanningStatus[] = [
      "BACKLOG",
      "PENDING_APPROVAL",
      "APPROVED",
      "IN_PROGRESS",
      "COMPLETED",
    ];

    const columnDTOs: PlanningKanbanColumnDTO[] = columnOrder.map((status) => {
      const entities = columns.get(status) || [];

      return {
        status,
        label: statusLabels[status],
        count: entities.length,
        cards: entities.map((entity) => {
          const counts = countsMap?.get(entity.id) || {
            items: 0,
            milestones: 0,
            completedMilestones: 0,
          };
          return this.toKanbanCard(
            entity,
            counts.items,
            counts.milestones,
            counts.completedMilestones,
          );
        }),
      };
    });

    const totalCards = columnDTOs.reduce((sum, col) => sum + col.count, 0);

    return {
      columns: columnDTOs,
      totalCards,
    };
  }
}
