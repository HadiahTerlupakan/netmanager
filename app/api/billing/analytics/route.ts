import { BillingAnalyticsService } from '@/modules/finance/services/BillingAnalyticsService'
import { apiSuccess, createHandler } from '@/lib/api'

const analyticsService = new BillingAnalyticsService()

/**
 * GET /api/billing/analytics
 * Get billing analytics and statistics
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    const { searchParams } = req.nextUrl
    const period = searchParams.get('period') || undefined
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const analytics = await analyticsService.getAnalytics({
        ...(period ? { period } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {})
    })

    return apiSuccess(analytics)
})
