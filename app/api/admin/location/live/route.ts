import { isSuperAdmin } from '@/lib/auth'
import { LocationTrackingService } from '@/modules/attendance'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { prisma } from '@/modules/database'

/**
 * GET /api/admin/location/live
 * Mengambil lokasi live semua karyawan yang sedang checked-in
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('live_tracking:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat live tracking')
    }

    const user = ctx.session!.user;
    const isSuper = isSuperAdmin(user);

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, siteId: true, departmentId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Prepare RBAC filters
    let siteId: string | undefined;
    let departmentId: string | undefined;
    const permissions = ctx.permissions || [];

    if (!isSuper) {
        if (permissions.includes('live_tracking:site_only') && dbUser.siteId) {
            siteId = dbUser.siteId;
        }
        if (permissions.includes('live_tracking:department_only') && dbUser.departmentId) {
            departmentId = dbUser.departmentId;
        }
    }

    const locationService = new LocationTrackingService()
    const liveLocations = await locationService.getLiveLocations({
        ...(siteId ? { siteId } : {}),
        ...(departmentId ? { departmentId } : {})
    })

    // console.log('[API /api/admin/location/live] isSuper:', isSuper, 'filters:', { siteId, departmentId }, 'count:', liveLocations.length)

    return apiSuccess({
        locations: liveLocations,
        tenantId: user.tenantId
    })
})
