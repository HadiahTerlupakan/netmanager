// Public API for Admin Module

// Services (public)
export { DashboardService, getDashboardService } from './services/DashboardService'
export type { TopEmployee, SystemSummary } from './services/DashboardService'

// DTOs (public types for API responses)
export type {
    SystemLogListItemDTO,
    SystemLogDetailDTO,
    ActivityTimelineDTO,
    LogStatisticsDTO,
} from './dto/SystemLogDTO'

// NOTE: SystemLogRepository is intentionally NOT exported (internal implementation detail)
// NOTE: SystemLogMapper is intentionally NOT exported (internal implementation detail)
