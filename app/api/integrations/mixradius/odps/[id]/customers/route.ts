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
  } catch (error: any) {
    console.error(`Error fetching customers for ODP ${id}:`, error)
    return ApiErrors.internalError(error.message || 'Failed to fetch ODP customers')
  }
}
