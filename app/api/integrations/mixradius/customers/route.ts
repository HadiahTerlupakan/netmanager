import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService, type FetchCustomersParams } from '@/modules/integrations'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/mixradius/customers
 *
 * Fetch data pelanggan PPP dari MixRadius secara on-demand
 *
 * Query Parameters:
 * - start: Offset untuk pagination (default: 0)
 * - length: Jumlah data per request (default: 10, max: 100)
 * - search: Search query (optional)
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Add RBAC permission check
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden()
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url)
    const start = parseInt(searchParams.get('start') || '0', 10)
    const length = parseInt(searchParams.get('length') || '10', 10)
    const search = searchParams.get('search') || ''
    const searchType = searchParams.get('searchType') || 'all'
    const authStatus = searchParams.get('authStatus') || undefined
    const sortBy = searchParams.get('sortBy') || undefined
    const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || undefined
    const forceRefresh = searchParams.get('forceRefresh') === 'true'

    // Fetch data from MixRadius
    const service = getMixRadiusService()

    // Construct params ensuring no explicit undefined values for exactOptionalPropertyTypes
    const params: FetchCustomersParams = {
      start,
      length: Math.min(length, 100),
      search,
      searchType,
      sortBy,
      sortDir,
      forceRefresh
    }

    if (authStatus) params.authStatus = authStatus
    if (searchParams.get('ownerName')) params.ownerName = searchParams.get('ownerName') || undefined
    if (searchParams.get('groupId')) params.groupId = searchParams.get('groupId') || undefined
    if (searchParams.get('onlineStatus')) params.onlineStatus = searchParams.get('onlineStatus') as 'online' | 'offline'
    if (searchParams.get('siteId')) params.siteId = searchParams.get('siteId') || undefined

    const data = await service.fetchCustomersPPP(params)

    return apiSuccess(data)
  } catch (error: unknown) {
    console.error('[API] MixRadius customers error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch MixRadius data'
    return ApiErrors.internalError(message)
  }
}
