import { NextRequest } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden()
    }

    const service = getMixRadiusService()
    const owners = await service.getUniqueOwners()

    return apiSuccess(owners)
  } catch (error: any) {
    console.error('[API] MixRadius Owners Error:', error.message)
    return ApiErrors.internalError(error.message || 'Internal Server Error')
  }
}
