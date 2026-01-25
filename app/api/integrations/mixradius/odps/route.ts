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
 * GET /api/integrations/mixradius/odps
 * Fetch list of ODPs from MixRadius
 */
export async function GET(request: Request) {
  const session = await requireAuth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const mixRadiusService = getMixRadiusService()
    const odps = await mixRadiusService.fetchODPList()

    return NextResponse.json({
      success: true,
      data: odps,
      total: odps.length,
    })
  } catch (error: any) {
    console.error('Error fetching ODP list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ODP list', message: error.message },
      { status: 500 }
    )
  }
}
