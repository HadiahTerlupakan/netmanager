import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)
    const permissions = await getUserPermissions(user.id)
    const hasAccess = isSuper || permissions.includes('*') || permissions.includes('mixradius:read');
    
    if (!hasAccess) {
      return ApiErrors.forbidden()
    }

    const service = getMixRadiusService()
    const owners = await service.getOwnersWithIds()

    return apiSuccess(owners)
})
