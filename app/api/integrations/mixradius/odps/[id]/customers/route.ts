import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/mixradius/odps/[id]/customers
 * Fetch customers for a specific ODP
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

    const { id } = ctx.params

    const mixRadiusService = getMixRadiusService()
    const customers = await mixRadiusService.fetchODPCustomers(id)

    return apiSuccess({
        data: customers,
        total: customers.length,
    })
})
