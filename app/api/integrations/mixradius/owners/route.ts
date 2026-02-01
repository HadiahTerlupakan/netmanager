import { NextRequest } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
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
    const owners = await service.getOwnersWithIds()

    return apiSuccess(owners)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    console.error('[API] MixRadius Owners Error:', message)
    return ApiErrors.internalError(message)
  }
}
