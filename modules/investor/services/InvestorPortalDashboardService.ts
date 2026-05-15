import { InvestorPortalRepository } from "../repositories/InvestorPortalRepository";
import {
  buildDashboardResponse,
  buildDashboardRevenueSnapshot,
  buildDashboardSubscriberMetrics,
} from "./investor-portal-dashboard.helpers";

export class InvestorPortalDashboardService {
  constructor(private readonly repository = new InvestorPortalRepository()) {}

  /** Mengambil ringkasan dashboard investor berbasis proyek aktif. */
  async getDashboard(investorId: string, tenantId?: string | null) {
    const projects = await this.repository.findDashboardProjects(
      investorId,
      tenantId ?? undefined,
    );
    const revenueSnapshot = await buildDashboardRevenueSnapshot(
      this.repository,
      projects,
    );
    const subscriberMetrics = buildDashboardSubscriberMetrics(revenueSnapshot);

    return buildDashboardResponse(projects, revenueSnapshot, subscriberMetrics);
  }
}

let investorPortalDashboardService: InvestorPortalDashboardService | null =
  null;

export function getInvestorPortalDashboardService(): InvestorPortalDashboardService {
  if (!investorPortalDashboardService) {
    investorPortalDashboardService = new InvestorPortalDashboardService();
  }

  return investorPortalDashboardService;
}
