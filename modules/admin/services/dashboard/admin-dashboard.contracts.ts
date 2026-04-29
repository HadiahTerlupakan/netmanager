import type { DashboardSection } from "@/lib/dashboard/contracts";
import type { MikroTikRouterStatistics } from "@/modules/network";
import type { SystemSummary, TopEmployee } from "../DashboardService";

export type AdminDashboardHeroViewModel = {
  viewerName: string;
  displayDate: string;
};

export type AdminDashboardSiteStat = {
  siteId: string;
  siteName: string;
  count: number;
};

export type AdminDashboardOverviewCards = {
  routerStats: MikroTikRouterStatistics;
};

export type AdminDashboardKpiCards = {
  systemSummary: SystemSummary;
};

export type AdminDashboardLeaderboards = {
  topEmployees: TopEmployee[];
  topProblematicSites: AdminDashboardSiteStat[];
  topDismantleSites: AdminDashboardSiteStat[];
  topInstallationSites: AdminDashboardSiteStat[];
};

export type AdminDashboardViewModel = {
  hero: AdminDashboardHeroViewModel;
  overview: DashboardSection<AdminDashboardOverviewCards>;
  kpis: DashboardSection<AdminDashboardKpiCards>;
  leaderboards: DashboardSection<AdminDashboardLeaderboards>;
};
