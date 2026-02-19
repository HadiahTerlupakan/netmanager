import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    
    // RBAC permission check
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)
    const hasAccess = isSuper || permissions.includes('mixradius:read') || permissions.includes('*')
    
    if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke data MixRadius')
    }

    const { id } = ctx.params

    if (!id) {
      return apiError('ID Pelanggan wajib disertakan', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const service = getMixRadiusService()
    const customerDetail = await service.fetchCustomerDetail(id)

    return apiSuccess(customerDetail)
})
