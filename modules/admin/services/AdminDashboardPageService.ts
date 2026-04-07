import { getDashboardService } from './DashboardService'
import { getMikroTikRouterRepository } from '@/lib/repositories'

export class AdminDashboardPageService {
  async getDashboardData(tenantId: string) {
    const routerRepository = getMikroTikRouterRepository()
    const dashboardService = getDashboardService()

    const [routerStats, topEmployees, topProblematicSites, topDismantleSites, topInstallationSites, systemSummary] = await Promise.all([
      routerRepository.getStatistics(tenantId),
      dashboardService.getTopEmployees(),
      dashboardService.getTopProblematicSites(),
      dashboardService.getTopDismantleSites(),
      dashboardService.getTopInstallationSites(),
      dashboardService.getSystemSummary(),
    ])

    return {
      routerStats,
      topEmployees,
      topProblematicSites,
      topDismantleSites,
      topInstallationSites,
      systemSummary,
    }
  }
}
