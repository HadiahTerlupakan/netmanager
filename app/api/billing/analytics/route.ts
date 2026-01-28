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
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const { searchParams } = new URL(req.url)
        const period = searchParams.get('period') || undefined
        const startDate = searchParams.get('startDate') || undefined
        const endDate = searchParams.get('endDate') || undefined

        const analytics = await analyticsService.getAnalytics({
            period,
            startDate,
            endDate,
        })

        return apiSuccess(analytics)
    } catch (error: any) {
        console.error('[Billing Analytics Error]:', error)
        return ApiErrors.internalError(error?.message || 'Gagal mengambil analytics billing')
    }
}