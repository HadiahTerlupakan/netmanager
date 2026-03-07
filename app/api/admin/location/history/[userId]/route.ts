import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


/**
 * GET /api/admin/location/history/[userId]
 * Mengambil history lokasi untuk user tertentu
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('live_tracking:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat history lokasi')
    }

    const { userId } = ctx.params
    const searchParams = req.nextUrl.searchParams
    
    // Parse dates - default to today
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    
    let startDate = new Date()
    startDate.setTime(toStartOfDay(startDate).getTime())
    
    let endDate = new Date()
    endDate.setTime(toEndOfDay(endDate).getTime())
    
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
})
