import { AdminDashboardComposer } from "./dashboard/AdminDashboardComposer";
import type { AdminDashboardViewModel } from "./dashboard/admin-dashboard.contracts";

const DEFAULT_VIEWER_NAME = "Admin";

type AdminDashboardPageInput = {
  tenantId: string;
  viewerName: string;
  now: Date;
};

export class AdminDashboardPageService {
  constructor(
    private readonly composer: AdminDashboardComposer = new AdminDashboardComposer(),
  ) {}

  /** Get admin dashboard page data for the current tenant. */
  async getDashboardData(
    inputOrTenantId: AdminDashboardPageInput | string,
  ): Promise<AdminDashboardViewModel> {
    return this.composer.compose(this.normalizeInput(inputOrTenantId));
  }

  private normalizeInput(
    inputOrTenantId: AdminDashboardPageInput | string,
  ): AdminDashboardPageInput {
    if (typeof inputOrTenantId !== "string") {
      return inputOrTenantId;
    }

    return {
      tenantId: inputOrTenantId,
      viewerName: DEFAULT_VIEWER_NAME,
      now: new Date(),
    };
  }
}
