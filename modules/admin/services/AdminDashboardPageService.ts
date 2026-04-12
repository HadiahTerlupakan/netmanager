import { AdminDashboardComposer } from "./dashboard/AdminDashboardComposer";
import type { AdminDashboardViewModel } from "./dashboard/admin-dashboard.contracts";

type AdminDashboardPageInput = {
  tenantId: string;
  viewerName: string;
  now: Date;
};

export class AdminDashboardPageService {
  private readonly composer = new AdminDashboardComposer();

  async getDashboardData(
    inputOrTenantId: AdminDashboardPageInput | string,
  ): Promise<AdminDashboardViewModel> {
    const normalizedInput =
      typeof inputOrTenantId === "string"
        ? {
            tenantId: inputOrTenantId,
            viewerName: "Admin",
            now: new Date(),
          }
        : inputOrTenantId;

    return this.composer.compose(normalizedInput);
  }
}
