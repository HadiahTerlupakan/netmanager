import { RadiusRepository } from "../repositories/RadiusRepository";
import { RadiusDashboardService } from "../services/dashboard/RadiusDashboardService";

export function createRadiusDashboardService(): RadiusDashboardService {
  return new RadiusDashboardService(new RadiusRepository());
}
