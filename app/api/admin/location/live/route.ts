import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'

/**
 * GET /api/admin/location/live
 * Mengambil lokasi live semua karyawan yang sedang checked-in
 * Untuk admin portal Live Map
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const locationService = new LocationTrackingService()
        const liveLocations = await locationService.getLiveLocations()

        return NextResponse.json({
            success: true,
            data: liveLocations,
            count: liveLocations.length,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Error fetching live locations:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
