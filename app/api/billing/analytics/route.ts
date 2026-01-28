import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { BillingAnalyticsService } from '@/modules/finance/services/BillingAnalyticsService'

const analyticsService = new BillingAnalyticsService()

/**
 * @swagger
 * /api/billing/analytics:
 *   get:
 *     summary: Get billing analytics and statistics
 *     description: Mengambil analytics dan statistik billing
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: ["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR"]
 *           default: "MONTH"
 *         description: Periode analytics
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Analytics berhasil diambil
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

        return NextResponse.json(analytics)
    } catch (error: any) {
        console.error('[Billing Analytics Error]:', error)
        return NextResponse.json(
            { error: error?.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}