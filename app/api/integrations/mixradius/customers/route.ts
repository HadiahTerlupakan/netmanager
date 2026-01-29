import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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

    // Fetch data from MixRadius
    const service = getMixRadiusService()
    
    // Construct params ensuring no explicit undefined values for exactOptionalPropertyTypes
    const params: any = {
      start,
      length: Math.min(length, 100),
      search,
      searchType,
    }
    
    if (authStatus) params.authStatus = authStatus
    if (searchParams.get('ownerName')) params.ownerName = searchParams.get('ownerName')
    if (searchParams.get('groupId')) params.groupId = searchParams.get('groupId')
    if (searchParams.get('onlineStatus')) params.onlineStatus = searchParams.get('onlineStatus') as any
    if (searchParams.get('siteId')) params.siteId = searchParams.get('siteId')

    const data = await service.fetchCustomersPPP(params)

    return apiSuccess(data)
  } catch (error: any) {
    console.error('[API] MixRadius customers error:', error)
    return ApiErrors.internalError(error.message || 'Failed to fetch MixRadius data')
  }
}
