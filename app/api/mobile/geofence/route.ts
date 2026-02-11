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
            return NextResponse.json({ error: 'Token hilang atau tidak valid' }, { status: 401 })
        }

        const token = authHeader.split(" ")[1]
        if (!token) {
            return NextResponse.json({ error: "Token tidak tersedia" }, { status: 401 })
        }
        const payload = await verifyMobileToken(token)
        if (!payload) {
            return NextResponse.json({ error: 'Token tidak valid atau kadaluarsa' }, { status: 401 })
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

    } catch (error: unknown) {
        console.error('Error fetching geofence zones:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
