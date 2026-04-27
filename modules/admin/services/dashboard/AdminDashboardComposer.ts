import { MikroTikRouterRepository } from "@/modules/network";
import type { IMikroTikStatisticsRepository } from "../../domain/ports/IAdminDashboardDependencies";
import {
  getDashboardService,
  type DashboardService,
} from "../DashboardService";
import type {
  AdminDashboardKpiCards,
  AdminDashboardLeaderboards,
  AdminDashboardOverviewCards,
  AdminDashboardViewModel,
} from "./admin-dashboard.contracts";
import { createDashboardSection } from "./admin-dashboard.mapper";

type AdminDashboardComposerDependencies = {
  routerRepository: IMikroTikStatisticsRepository;
  dashboardService: DashboardService;
};

type AdminDashboardComposerInput = {
  tenantId: string;
  viewerName: string;
  now: Date;
};

const LEADERBOARD_ERROR_MESSAGE = "Gagal memuat leaderboard admin dashboard";
const KPI_ERROR_MESSAGE = "Gagal memuat KPI admin dashboard";
const OVERVIEW_ERROR_MESSAGE = "Gagal memuat overview admin dashboard";

export class AdminDashboardComposer {
  constructor(
    private readonly dependencies: Partial<AdminDashboardComposerDependencies> = {},
  ) {}

  /** Compose full admin dashboard view model. */
  async compose(
    input: AdminDashboardComposerInput,
  ): Promise<AdminDashboardViewModel> {
    const routerRepository =
      this.dependencies.routerRepository ?? new MikroTikRouterRepository();
    const dashboardService =
      this.dependencies.dashboardService ?? getDashboardService();

    const [routerStatsResult, systemSummaryResult, leaderboardResult] =
      await Promise.allSettled([
        routerRepository.getStatistics(input.tenantId),
        dashboardService.getSystemSummary({ tenantId: input.tenantId }),
        this.loadLeaderboards(dashboardService, input.tenantId),
      ]);

    return {
      hero: {
        viewerName: input.viewerName,
        displayDate: this.formatDisplayDate(input.now),
      },
      overview: createDashboardSection<AdminDashboardOverviewCards>(
        routerStatsResult.status === "fulfilled"
          ? {
              status: "fulfilled",
              value: { routerStats: routerStatsResult.value },
            }
          : routerStatsResult,
        OVERVIEW_ERROR_MESSAGE,
      ),
      kpis: createDashboardSection<AdminDashboardKpiCards>(
        systemSummaryResult.status === "fulfilled"
          ? {
              status: "fulfilled",
              value: { systemSummary: systemSummaryResult.value },
            }
          : systemSummaryResult,
        KPI_ERROR_MESSAGE,
      ),
      leaderboards: this.mapLeaderboards(leaderboardResult),
    };
  }

  private async loadLeaderboards(
    dashboardService: DashboardService,
    tenantId: string,
  ): Promise<AdminDashboardLeaderboards> {
    const [
      topEmployees,
      topProblematicSites,
      topDismantleSites,
      topInstallationSites,
    ] = await Promise.allSettled([
      dashboardService.getTopEmployees({ tenantId }),
      dashboardService.getTopProblematicSites({ tenantId }),
      dashboardService.getTopDismantleSites({ tenantId }),
      dashboardService.getTopInstallationSites({ tenantId }),
    ]);

    const failures = [
      topEmployees,
      topProblematicSites,
      topDismantleSites,
      topInstallationSites,
    ].filter((result) => result.status === "rejected");

    if (failures.length > 0) {
      throw new Error("Gagal memuat salah satu leaderboard admin dashboard");
    }

    return {
      topEmployees:
        topEmployees.status === "fulfilled" ? topEmployees.value : [],
      topProblematicSites:
        topProblematicSites.status === "fulfilled"
          ? topProblematicSites.value
          : [],
      topDismantleSites:
        topDismantleSites.status === "fulfilled" ? topDismantleSites.value : [],
      topInstallationSites:
        topInstallationSites.status === "fulfilled"
          ? topInstallationSites.value
          : [],
    };
  }

  private mapLeaderboards(
    result: PromiseSettledResult<AdminDashboardLeaderboards>,
  ) {
    if (result.status === "fulfilled") {
      return createDashboardSection(
        {
          status: "fulfilled",
          value: result.value,
        },
        LEADERBOARD_ERROR_MESSAGE,
      );
    }

    return {
      state: "error" as const,
      data: null,
      message: LEADERBOARD_ERROR_MESSAGE,
    };
  }

  private formatDisplayDate(now: Date): string {
    return now.toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}
