import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/integrations/mixradius/odps
 * Fetch list of ODPs from MixRadius
 */
export async function GET(_request: Request) {
  const session = await requireAuth()
  if (!session) {
    return ApiErrors.unauthorized()
  }

  try {
    const mixRadiusService = getMixRadiusService()
    const odps = await mixRadiusService.fetchODPList()

    return apiSuccess({
      data: odps,
      total: odps.length,
    })
  } catch (error: any) {
    console.error('Error fetching ODP list:', error)
    return ApiErrors.internalError(error.message || 'Failed to fetch ODP list')
  }
}
