import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { BillingAnalyticsService } from '@/modules/finance/services/BillingAnalyticsService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const analyticsService = new BillingAnalyticsService()

/**
 * @swagger
 * /api/billing/analytics:
 *   get:
 *     summary: Get billing analytics and statistics
 *     tags: [Billing]
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { searchParams } = new URL(req.url)
        const period = searchParams.get('period') || undefined
        const startDate = searchParams.get('startDate') || undefined
        const endDate = searchParams.get('endDate') || undefined

        const analytics = await analyticsService.getAnalytics({
            ...(period ? { period } : {}),
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {})
        })

        return apiSuccess(analytics)
    } catch (error: unknown) {
        console.error('[Billing Analytics Error]:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil analytics billing'
        return ApiErrors.internalError(errorMessage)
    }
}