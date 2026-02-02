import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

async function requireAuth() {
  const session = await getServerSession(authConfig)
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
  } catch (error: unknown) {
    console.error('Error fetching ODP list:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch ODP list'
    return ApiErrors.internalError(message)
  }
}
