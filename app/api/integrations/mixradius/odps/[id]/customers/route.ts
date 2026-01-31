import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

async function requireAuth() {
  const session = await getServerSession(authConfig)
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/integrations/mixradius/odps/[id]/customers
 * Fetch customers for a specific ODP
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth()
  if (!session) {
    return ApiErrors.unauthorized()
  }

  const { id } = await params

  try {
    const mixRadiusService = getMixRadiusService()
    const customers = await mixRadiusService.fetchODPCustomers(id)

    return apiSuccess({
      data: customers,
      total: customers.length,
    })
  } catch (error: unknown) {
    console.error(`Error fetching customers for ODP ${id}:`, error)
    const message = error instanceof Error ? error.message : 'Failed to fetch ODP customers'
    return ApiErrors.internalError(message)
  }
}
