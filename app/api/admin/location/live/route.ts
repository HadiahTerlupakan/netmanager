import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'
import { hasPermission } from '@/lib/rbac'

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

        // Permission check
        if (!await hasPermission('live_tracking:read')) {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to view live tracking' }, { status: 403 })
        }

        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // Prepare RBAC filters
        let siteId: string | undefined;
        let departmentId: string | undefined;

        if (!isSuperAdmin) {
            if (user.permissions?.includes('live_tracking:site_only') && user.siteId) {
                siteId = user.siteId;
            }
            if (user.permissions?.includes('live_tracking:department_only') && user.departmentId) {
                departmentId = user.departmentId;
            }
        }

        const locationService = new LocationTrackingService()
        const liveLocations = await locationService.getLiveLocations({ siteId, departmentId })

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
