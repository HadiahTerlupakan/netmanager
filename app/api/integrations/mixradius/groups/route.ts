
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'

/**
 * GET /api/integrations/mixradius/groups
 * Get all owner groups (Sites)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = getMixRadiusService()
    const groups = await service.getOwnerGroups()

    return NextResponse.json(groups)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/integrations/mixradius/groups
 * Create new owner group
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = await getUserPermissions(session.id)
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    
    if (!isSuperAdmin && !permissions.includes('mixradius:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, owners, siteId } = body

    if (!name || !owners || !Array.isArray(owners)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }

    const service = getMixRadiusService()
    const newGroup = await service.createOwnerGroup({ name, owners, siteId })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id: newGroup.id, name: newGroup.name, owners: newGroup.owners }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json(newGroup)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
