import { createPointClaimService } from "@/modules/marketing";
import { AttendanceQueryService } from "@/modules/attendance";
import { InventoryQueryService } from "@/modules/inventory";
import { UserLookupService } from "@/modules/users";
import { WorkOrderQueryService } from "@/modules/work-order";
import type {
  DashboardLimitInput,
  DashboardTenantInput,
  DashboardUserDetails,
  IAttendanceDashboardRepository,
  IInventoryDashboardRepository,
  IPointClaimDashboardService,
  IUserDashboardRepository,
  IWorkOrderDashboardRepository,
  SiteStat,
} from "../domain/ports/IAdminDashboardDependencies";
import {
  buildRecentRange,
  buildTodayRange,
  buildTopEmployeeScores,
  sortTopEmployeeScores,
  summarizeAttendance,
  summarizeWorkOrders,
} from "./dashboard-helpers";

const DEFAULT_LEADERBOARD_LIMIT = 5;
const RECENT_PERIOD_DAYS = 30;
const LOW_STOCK_PLACEHOLDER = 0;
const INITIAL_RANK = 1;
const UNKNOWN_USER_NAME = "Unknown";

type TopEmployeeScore = {
  attendance: number;
  workOrder: number;
  total: number;
};

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

type DashboardServiceDependencies = {
  attendanceRepository: IAttendanceDashboardRepository;
  workOrderRepository: IWorkOrderDashboardRepository;
  pointClaimService: IPointClaimDashboardService;
  inventoryRepository: IInventoryDashboardRepository;
  userRepository: IUserDashboardRepository;
};

export class DashboardService {
  constructor(private readonly dependencies: DashboardServiceDependencies) {}

  /** Get integrated system summary for the admin dashboard. */
  async getSystemSummary(input: DashboardTenantInput): Promise<SystemSummary> {
    const { startOfDay, endOfDay } = buildTodayRange();
    const recentRange = buildRecentRange(RECENT_PERIOD_DAYS);
    const [inventory, marketing, workOrderStats, dailyAttendance] =
      await Promise.all([
        this.dependencies.inventoryRepository.findAllBarang({
          take: INITIAL_RANK,
          tenantId: input.tenantId,
        }),
        this.dependencies.pointClaimService.getDashboardSummary(input.tenantId),
        this.dependencies.workOrderRepository.getStatistics(
          { dateFrom: recentRange.startDate },
          input.tenantId,
        ),
        this.dependencies.attendanceRepository.getDailyStats(
          startOfDay,
          endOfDay,
          undefined,
          undefined,
          input.tenantId,
        ),
      ]);

    return {
      inventory: this.mapInventorySummary(inventory.total),
      marketing,
      workOrder: summarizeWorkOrders(workOrderStats),
      attendance: summarizeAttendance(dailyAttendance[0]),
    };
  }

  /** Get top employees based on attendance and work order score. */
  async getTopEmployees(input: DashboardLimitInput): Promise<TopEmployee[]> {
    const limit = input.limit ?? DEFAULT_LEADERBOARD_LIMIT;
    const recentRange = buildRecentRange(RECENT_PERIOD_DAYS);
    const [attendanceStats, workOrderStats] = await Promise.all([
      this.dependencies.attendanceRepository.getUserAttendanceStats(
        recentRange.startDate,
        recentRange.endDate,
        undefined,
        undefined,
        input.tenantId,
      ),
      this.dependencies.workOrderRepository.getUserWorkOrderStats(
        recentRange.startDate,
        recentRange.endDate,
        input.tenantId,
      ),
    ]);
    const userScores = buildTopEmployeeScores(attendanceStats, workOrderStats);
    const sortedIds = sortTopEmployeeScores(userScores, limit);

    if (sortedIds.length === 0) {
      return [];
    }

    const userIds = sortedIds.map(([userId]) => userId);
    const users =
      await this.dependencies.userRepository.findManyWithFullDetails(
        userIds,
        input.tenantId,
      );

    return sortedIds
      .map(([userId, score], index) =>
        this.mapTopEmployee(users, userId, score, index),
      )
      .filter((employee): employee is TopEmployee => employee !== null);
  }

  /** Get sites with highest troubleshoot activity. */
  async getTopProblematicSites(
    input: DashboardLimitInput,
  ): Promise<SiteStat[]> {
    return this.getSiteStatsByType(input, ["TROUBLESHOOT"]);
  }

  /** Get sites with highest disconnection activity. */
  async getTopDismantleSites(input: DashboardLimitInput): Promise<SiteStat[]> {
    return this.getSiteStatsByType(input, ["DISCONNECTION"]);
  }

  /** Get sites with highest installation activity. */
  async getTopInstallationSites(
    input: DashboardLimitInput,
  ): Promise<SiteStat[]> {
    return this.getSiteStatsByType(input, ["INSTALLATION"]);
  }

  /** Map inventory aggregate into dashboard summary shape. */
  private mapInventorySummary(totalItems: number) {
    return {
      totalItems,
      lowStockItems: LOW_STOCK_PLACEHOLDER,
    };
  }

  /** Map ranked score into top employee DTO shape. */
  private mapTopEmployee(
    users: DashboardUserDetails[],
    userId: string,
    score: TopEmployeeScore,
    index: number,
  ): TopEmployee | null {
    const user = users.find((candidate) => candidate.id === userId);
    if (!user?.name || user.name === UNKNOWN_USER_NAME) {
      return null;
    }

    return {
      userId,
      name: user.name,
      role: user.role?.name ?? null,
      department: user.departments?.name ?? null,
      site: user.sites?.name ?? null,
      avatar: user.image ?? null,
      metrics: {
        attendanceCount: score.attendance,
        workOrderCount: score.workOrder,
        totalScore: score.total,
      },
      rank: index + INITIAL_RANK,
    };
  }

  /** Load site statistics filtered by work-order types. */
  private async getSiteStatsByType(
    input: DashboardLimitInput,
    workOrderTypes: string[],
  ): Promise<SiteStat[]> {
    const limit = input.limit ?? DEFAULT_LEADERBOARD_LIMIT;
    const recentRange = buildRecentRange(RECENT_PERIOD_DAYS);

    return this.dependencies.workOrderRepository.getSiteStatsByType(
      workOrderTypes,
      limit,
      recentRange.startDate,
      recentRange.endDate,
      input.tenantId,
    );
  }
}

/** Create a dashboard service with default repository implementations. */
export function createDashboardService(
  dependencies?: Partial<DashboardServiceDependencies>,
): DashboardService {
  return new DashboardService({
    attendanceRepository:
      dependencies?.attendanceRepository ?? new AttendanceQueryService(),
    workOrderRepository:
      dependencies?.workOrderRepository ?? new WorkOrderQueryService(),
    pointClaimService:
      dependencies?.pointClaimService ?? createPointClaimService(),
    inventoryRepository:
      dependencies?.inventoryRepository ?? new InventoryQueryService(),
    userRepository: dependencies?.userRepository ?? new UserLookupService(),
  });
}

let instance: DashboardService | null = null;

/** Get singleton dashboard service instance. */
export function getDashboardService(): DashboardService {
  if (!instance) {
    instance = createDashboardService();
  }

  return instance;
}
