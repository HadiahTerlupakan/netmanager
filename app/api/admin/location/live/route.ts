import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { LocationTrackingService } from '@/modules/attendance/services/LocationTrackingService'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * GET /api/admin/location/live
 * Mengambil lokasi live semua karyawan yang sedang checked-in
 * Untuk admin portal Live Map
 */
export async function GET(_request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        // Permission check
        if (!await hasPermission('live_tracking:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat live tracking')
        }

        const user = session.user as {
            role: string;
            permissions?: string[];
            siteId?: string;
            departmentId?: string;
        };
        const isSuper = isSuperAdmin(user as any);

        // Prepare RBAC filters
        let siteId: string | undefined;
        let departmentId: string | undefined;

        if (!isSuper) {
            if (user.permissions?.includes('live_tracking:site_only') && user.siteId) {
                siteId = user.siteId;
            }
            if (user.permissions?.includes('live_tracking:department_only') && user.departmentId) {
                departmentId = user.departmentId;
            }
        }

        const locationService = new LocationTrackingService()
        const liveLocations = await locationService.getLiveLocations({
            ...(siteId ? { siteId } : {}),
            ...(departmentId ? { departmentId } : {})
        })

        return apiSuccess({
            data: liveLocations,
            count: liveLocations.length,
            timestamp: new Date().toISOString()
        })

    } catch (error: unknown) {
        console.error('Error fetching live locations:', error)
        return ApiErrors.internalError('Gagal mengambil lokasi live')
    }
}
