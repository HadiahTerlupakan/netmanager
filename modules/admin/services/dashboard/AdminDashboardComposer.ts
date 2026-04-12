import { MikroTikRouterRepository } from "@/modules/network";
import { getDashboardService, DashboardService } from "../DashboardService";
import type {
  AdminDashboardLeaderboards,
  AdminDashboardOverviewCards,
  AdminDashboardViewModel,
  AdminDashboardKpiCards,
} from "./admin-dashboard.contracts";
import { createDashboardSection } from "./admin-dashboard.mapper";

type AdminDashboardComposerDependencies = {
  routerRepository: MikroTikRouterRepository;
  dashboardService: DashboardService;
};

type AdminDashboardComposerInput = {
  tenantId: string;
  viewerName: string;
  now: Date;
};

export class AdminDashboardComposer {
  constructor(
    private readonly dependencies: Partial<AdminDashboardComposerDependencies> = {},
  ) {}

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
        "Gagal memuat overview admin dashboard",
      ),
      kpis: createDashboardSection<AdminDashboardKpiCards>(
        systemSummaryResult.status === "fulfilled"
          ? {
              status: "fulfilled",
              value: { systemSummary: systemSummaryResult.value },
            }
          : systemSummaryResult,
        "Gagal memuat KPI admin dashboard",
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
        "Gagal memuat leaderboard admin dashboard",
      );
    }

    return {
      state: "error" as const,
      data: null,
      message: "Gagal memuat leaderboard admin dashboard",
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
