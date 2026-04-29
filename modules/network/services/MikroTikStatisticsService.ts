import { MikroTikRouterRepository } from "../repositories/MikroTikRouterRepository";

export class MikroTikStatisticsService {
  constructor(private readonly repository = new MikroTikRouterRepository()) {}

  /** Get aggregated MikroTik router statistics for a tenant. */
  getStatistics(tenantId?: string) {
    return this.repository.getStatistics(tenantId);
  }
}
