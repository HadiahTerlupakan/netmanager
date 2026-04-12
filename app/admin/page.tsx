import { ensureAdminDashboardAccess } from "@/lib/server-auth";
import { AdminDashboardPageService } from "@/modules/admin";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function Page() {
  const access = await ensureAdminDashboardAccess();
  const pageService = new AdminDashboardPageService();
  const viewModel = await pageService.getDashboardData({
    tenantId: access.tenantId,
    viewerName: access.user.name || "Admin",
    now: new Date(),
  });

  return <AdminDashboardClient viewModel={viewModel} />;
}
