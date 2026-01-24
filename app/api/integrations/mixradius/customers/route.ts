import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add RBAC permission check
    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    const data = await service.fetchCustomersPPP({
      start,
      length: Math.min(length, 100), // Max 100 per request
      search,
      searchType,
      authStatus,
      ownerName: searchParams.get('ownerName') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      onlineStatus: searchParams.get('onlineStatus') as any || undefined,
      siteId: searchParams.get('siteId') || undefined,
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API] MixRadius customers error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch MixRadius data' },
      { status: 500 }
    )
  }
}
