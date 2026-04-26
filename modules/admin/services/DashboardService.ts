import { AttendanceRepository } from "@/modules/attendance";
import { WorkOrderRepository } from "@/modules/work-order";
import { InventoryRepository } from "@/modules/inventory";
import { UserRepository } from "@/modules/users";
import { createPointClaimService } from "@/modules/marketing";
import {
  buildRecentRange,
  buildTodayRange,
  buildTopEmployeeScores,
  sortTopEmployeeScores,
  summarizeAttendance,
  summarizeWorkOrders,
} from "./dashboard-helpers";

export type TopEmployee = {
  userId: string;
  name: string;
  role: string | null;
  department: string | null;
  site: string | null;
  avatar: string | null;
  metrics: {
    attendanceCount: number;
    workOrderCount: number;
    totalScore: number;
  };
  rank: number;
};

export type SystemSummary = {
  inventory: {
    totalItems: number;
    lowStockItems: number;
  };
  marketing: {
    totalPoints: number;
    pendingClaims: number;
    approvedClaims: number;
  };
  workOrder: {
    pending: number;
    inProgress: number;
    completed: number;
  };
  attendance: {
    present: number;
    late: number;
    absent: number;
  };
};

type DashboardTenantInput = {
  tenantId: string;
};

type DashboardLimitInput = {
  tenantId: string;
  limit?: number;
};

export type SiteStat = {
  siteId: string;
  siteName: string;
  count: number;
};

export class DashboardService {
  private attendanceRepo = new AttendanceRepository();
  private workOrderRepo = new WorkOrderRepository();
  private pointClaimService = createPointClaimService();
  private inventoryRepo = new InventoryRepository();
  private userRepo = new UserRepository();

  /**
   * Get Integrated System Summary
   */
  async getSystemSummary(input: DashboardTenantInput): Promise<SystemSummary> {
    const { startOfDay, endOfDay } = buildTodayRange();

    const inventory = await this.inventoryRepo.findAllBarang({
      take: 1,
      tenantId: input.tenantId,
    });
    const marketing = await this.pointClaimService.getDashboardSummary(
      input.tenantId,
    );

    const { startDate: woStartDate } = buildRecentRange(30);
    const woStats = await this.workOrderRepo.getStatistics(
      { dateFrom: woStartDate },
      input.tenantId,
    );

    const dailyAttendance = await this.attendanceRepo.getDailyStats(
      startOfDay,
      endOfDay,
      undefined,
      undefined,
      input.tenantId,
    );
    const attendance = summarizeAttendance(dailyAttendance[0]);

    return {
      inventory: {
        totalItems: inventory.total,
        lowStockItems: 0,
      },
      marketing,
      workOrder: summarizeWorkOrders(woStats),
      attendance,
    };
  }

  /**
   * Get Top Employees based on integrated score (Attendance + WorkOrder)
   * Score = Attendance Days + Completed Work Orders
   */
  async getTopEmployees(input: DashboardLimitInput): Promise<TopEmployee[]> {
    const limit = input.limit ?? 5;
    const { startDate, endDate } = buildRecentRange(30);

    const [attendanceStats, workOrderStats] = await Promise.all([
      this.attendanceRepo.getUserAttendanceStats(
        startDate,
        endDate,
        undefined,
        undefined,
        input.tenantId,
      ),
      this.workOrderRepo.getUserWorkOrderStats(
        startDate,
        endDate,
        input.tenantId,
      ),
    ]);

    const userScores = buildTopEmployeeScores(attendanceStats, workOrderStats);
    const sortedIds = sortTopEmployeeScores(userScores, limit);

    if (sortedIds.length === 0) return [];

    const users = await this.userRepo.findManyWithFullDetails(
      sortedIds.map(([id]) => id),
      input.tenantId,
    );

    return sortedIds
      .map(([userId, score], index): TopEmployee => {
        const user = users.find(
          (candidate: {
            id: string;
            name: string | null;
            image: string | null;
            sites: { name: string } | null;
            departments: { name: string } | null;
          }) => candidate.id === userId,
        );
        return {
          userId,
          name: user?.name || "Unknown",
          role: user?.role?.name || null,
          department: user?.departments?.name || null,
          site: user?.sites?.name || null,
          avatar: user?.image || null,
          metrics: {
            attendanceCount: score.attendance,
            workOrderCount: score.workOrder,
            totalScore: score.total,
          },
          rank: index + 1,
        };
      })
      .filter((u) => u.name !== "Unknown");
  }

  /**
   * Get Top Problematic Sites (High TROUBLESHOOT count)
   */
  async getTopProblematicSites(
    input: DashboardLimitInput,
  ): Promise<SiteStat[]> {
    const limit = input.limit ?? 5;
    const { startDate, endDate } = buildRecentRange(30);

    return this.workOrderRepo.getSiteStatsByType(
      ["TROUBLESHOOT"],
      limit,
      startDate,
      endDate,
      input.tenantId,
    );
  }

  /**
   * Get Top Dismantle Sites (High DISCONNECTION count)
   */
  async getTopDismantleSites(input: DashboardLimitInput): Promise<SiteStat[]> {
    const limit = input.limit ?? 5;
    const { startDate, endDate } = buildRecentRange(30);

    return this.workOrderRepo.getSiteStatsByType(
      ["DISCONNECTION"],
      limit,
      startDate,
      endDate,
      input.tenantId,
    );
  }

  /**
   * Get Top Installation Sites (High INSTALLATION count)
   */
  async getTopInstallationSites(
    input: DashboardLimitInput,
  ): Promise<SiteStat[]> {
    const limit = input.limit ?? 5;
    const { startDate, endDate } = buildRecentRange(30);

    return this.workOrderRepo.getSiteStatsByType(
      ["INSTALLATION"],
      limit,
      startDate,
      endDate,
      input.tenantId,
    );
  }
}

// Singleton pattern (consistent with other services)
let instance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
  if (!instance) {
    instance = new DashboardService();
  }
  return instance;
}
