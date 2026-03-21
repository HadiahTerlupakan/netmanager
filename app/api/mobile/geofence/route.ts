import { GeofenceService } from '@/modules/attendance/services/GeofenceService'
import { apiSuccess, createHandler } from '@/lib/api'

/**
 * GET /api/mobile/geofence
 * Mengambil daftar zona geofence untuk user yang sedang login
 */
export const GET = createHandler({ auth: true }, async (_request, ctx) => {
    const userId = ctx.session!.user.id
    const geofenceService = new GeofenceService()
    const [zones, policy] = await Promise.all([
        geofenceService.getZonesForUser(userId),
        geofenceService.getPolicyForUser(userId)
    ])

    return apiSuccess({
        zones,
        policy,
        // Config for mobile app
        config: {
            enableWarning: true,  // Show warning if outside zone
            requirePhoto: true,   // Require photo for attendance
        }
    })
})
