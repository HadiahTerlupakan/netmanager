import { NextRequest, NextResponse } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { verifyAuth, getUserPermissions } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = getMixRadiusService()
    const owners = await service.getUniqueOwners()

    return NextResponse.json({ 
      data: owners 
    })
  } catch (error: any) {
    console.error('[API] MixRadius Owners Error:', error.message)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
