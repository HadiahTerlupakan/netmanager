import { getServerSession } from 'next-auth'
import { authConfig, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

async function requireAuth() {
  const session = await getServerSession(authConfig)
  if (!session?.user) {
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

  // Permission check
  const user = session.user as { id: string; role?: string; isSuperAdmin?: boolean }
  const isSuper = isSuperAdmin(user)

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id)
    const hasAccess = permissions.includes('mixradius:read') ||
                      permissions.includes('*')
    if (!hasAccess) {
      return ApiErrors.forbidden('Anda tidak memiliki akses ke data MixRadius')
    }
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
    const message = error instanceof Error ? error.message : 'Gagal mengambil data pelanggan ODP'
    return ApiErrors.internalError(message)
  }
}
