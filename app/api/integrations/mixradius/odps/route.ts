import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/mixradius/odps
 * Fetch list of ODPs from MixRadius
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
        const permissions = await getUserPermissions(user.id)
        const hasAccess = permissions.includes('mixradius:read') ||
                        permissions.includes('*')
        if (!hasAccess) {
            return ApiErrors.forbidden('Anda tidak memiliki akses ke data MixRadius')
        }
    }

    const mixRadiusService = getMixRadiusService()
    const odps = await mixRadiusService.fetchODPList()

    return apiSuccess({
        data: odps,
        total: odps.length,
    })
})
