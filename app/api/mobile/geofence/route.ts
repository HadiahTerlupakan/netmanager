import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'

/**
 * GET /api/mobile/geofence
 * Mengambil daftar zona geofence untuk user yang sedang login
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const userId = payload.userId || payload.sub
        const geofenceService = new GeofenceService()
        const [zones, policy] = await Promise.all([
            geofenceService.getZonesForUser(userId),
            geofenceService.getPolicyForUser(userId)
        ])

        return NextResponse.json({
            success: true,
            data: {
                zones,
                policy,
                // Config for mobile app
                config: {
                    enableWarning: true,  // Show warning if outside zone
                    requirePhoto: true,   // Require photo for attendance
                }
            }
        })

    } catch (error: unknown) {
        console.error('Error fetching geofence zones:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
