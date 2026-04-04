import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

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

  try {
    const service = getMixRadiusService()
    const activeSessions = await service.fetchActiveSessionsPPP()

    return apiSuccess({
      count: activeSessions.size,
      usernames: Array.from(activeSessions).slice(0, 50),
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'MixRadiusConfigError') {
      return apiSuccess({
        error: error.message,
        isConfigError: true,
        count: 0,
        usernames: []
      })
    }
    throw error
  }
})
