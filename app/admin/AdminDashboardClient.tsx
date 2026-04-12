import { DashboardSocketUpdate } from "@/components/dashboard/DashboardSocketUpdate";
import type { AdminDashboardViewModel } from "@/modules/admin";
import { AdminDashboardHero } from "./_components/AdminDashboardHero";
import { AdminDashboardOverviewSection } from "./_components/AdminDashboardOverviewSection";
import { AdminDashboardKpiSection } from "./_components/AdminDashboardKpiSection";
import { AdminDashboardLeaderboardSection } from "./_components/AdminDashboardLeaderboardSection";

interface AdminDashboardClientProps {
  viewModel: AdminDashboardViewModel;
}

export function AdminDashboardClient({ viewModel }: AdminDashboardClientProps) {
  return (
    <div className="space-y-8">
      <DashboardSocketUpdate />
      <AdminDashboardHero hero={viewModel.hero} />
      <AdminDashboardOverviewSection section={viewModel.overview} />
      <AdminDashboardKpiSection section={viewModel.kpis} />
      <AdminDashboardLeaderboardSection section={viewModel.leaderboards} />
    </div>
  );
}
