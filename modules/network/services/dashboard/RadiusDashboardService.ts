import { RadiusRepository } from "../../repositories/RadiusRepository";
import type {
  RadiusDashboardStatsInput,
  RadiusDashboardStatsViewModel,
  RadiusRecentSessionsInput,
  RadiusRecentSessionsViewModel,
} from "./radius-dashboard.contracts";
import {
  extractUsernames,
  mapDashboardStats,
  mapRecentSessions,
  normalizeRecentSessionsPagination,
} from "./radius-dashboard.mapper";

export class RadiusDashboardService {
  constructor(
    private readonly repository: RadiusRepository = new RadiusRepository(),
  ) {}

  /**
   * Get stable stats view model for dashboard consumers.
   */
  async getStats(
    input: RadiusDashboardStatsInput,
  ): Promise<RadiusDashboardStatsViewModel> {
    const stats = await this.repository.getDashboardStats(input.tenantId);
    return mapDashboardStats(stats);
  }

  /**
   * Get recent sessions with stable pagination and usage enrichment.
   */
  async getRecentSessions(
    input: RadiusRecentSessionsInput,
  ): Promise<RadiusRecentSessionsViewModel> {
    const { sessions, total } = await this.repository.getRecentSessions(
      input.tenantId,
      {
        page: input.page,
        limit: input.limit,
        status: input.status,
      },
    );

    const usernames = extractUsernames(sessions);
    const totalUsageByUsername = await this.repository.getTotalUsageByUsernames(
      input.tenantId,
      usernames,
    );

    return mapRecentSessions(
      sessions,
      totalUsageByUsername,
      normalizeRecentSessionsPagination(input.page, input.limit, total),
    );
  }
}
