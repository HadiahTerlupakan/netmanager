import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { GeofenceService } from '@/modules/attendance/services/GeofenceService'

/**
 * GET /api/mobile/geofence
 * Mengambil daftar zona geofence untuk user yang sedang login
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Missing or invalid token' }, { status: 401 })
        }

        const token = authHeader.split(' ')[1]
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
        }

        const userId = payload.id as string
        const geofenceService = new GeofenceService()
        const zones = await geofenceService.getZonesForUser(userId)

        return NextResponse.json({
            success: true,
            data: {
                zones,
                // Config for mobile app
                config: {
                    enableWarning: true,  // Show warning if outside zone
                    requirePhoto: true,   // Require photo for attendance
                }
            }
        })

    } catch (error: any) {
        console.error('Error fetching geofence zones:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
