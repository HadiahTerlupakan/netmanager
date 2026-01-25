import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'

async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    return null
  }
  return session
}

/**
 * GET /api/ftth/topology/mixradius
 * Fetch MixRadius topology data (ODPs + Customers) for the map
 */
export async function GET(request: Request) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const ownerName = searchParams.get('ownerName') || undefined

  try {
    const mixRadiusService = getMixRadiusService()
    const topologyData = await mixRadiusService.fetchTopologyData({ ownerName })

    return NextResponse.json(topologyData)
  } catch (error: any) {
    console.error('Error fetching MixRadius topology data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch topology data', message: error.message },
      { status: 500 }
    )
  }
}
