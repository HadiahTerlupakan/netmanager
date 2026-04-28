// Public API for Admin Module

// Services (public)
export {
  DashboardService,
  createDashboardService,
  getDashboardService,
} from "./services/DashboardService";
export type { SystemSummary, TopEmployee } from "./services/DashboardService";
export { AdminDashboardPageService } from "./services/AdminDashboardPageService";
export { SystemLogRouteService } from "./services/SystemLogRouteService";
export {
  AdminTenantRouteService,
  tenantRouteErrorMessages,
} from "./services/AdminTenantRouteService";
export {
  TenantContextLookupService,
  getTenantContextLookupService,
} from "./services/TenantContextLookupService";
export type { TenantContextLookupResult } from "./services/TenantContextLookupService";
export type {
  AdminDashboardHeroViewModel,
  AdminDashboardKpiCards,
  AdminDashboardLeaderboards,
  AdminDashboardOverviewCards,
  AdminDashboardViewModel,
} from "./services/dashboard/admin-dashboard.contracts";

// DTOs (public types for API responses)
export type {
  ActivityTimelineDTO,
  LogStatisticsDTO,
  SystemLogDetailDTO,
  SystemLogListItemDTO,
} from "./dto/SystemLogDTO";
