import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * GET /api/admin/location/history/[userId]
 * Mengambil history lokasi untuk user tertentu
 * Query params: startDate, endDate
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        if (!await hasPermission('live_tracking:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat history lokasi')
        }

        const { userId } = await params
        const searchParams = request.nextUrl.searchParams
        
        // Parse dates - default to today
        const startDateParam = searchParams.get('startDate')
        const endDateParam = searchParams.get('endDate')
        
        let startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        
        let endDate = new Date()
        endDate.setHours(23, 59, 59, 999)
        
        if (startDateParam) {
            startDate = new Date(startDateParam)
        }
        if (endDateParam) {
            endDate = new Date(endDateParam)
        }

        const locationService = new LocationTrackingService()
        
        const [history, stats] = await Promise.all([
            locationService.getLocationHistory(userId, startDate, endDate),
            locationService.getLocationStats(userId, startDate)
        ])

        return apiSuccess({
            locations: history,
            stats,
            userId,
            dateRange: {
                start: startDate.toISOString(),
                end: endDate.toISOString()
            }
        })

    } catch (error: unknown) {
        console.error('Error fetching location history:', error)
        return ApiErrors.internalError('Gagal mengambil history lokasi')
    }
}
