
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/mixradius'

interface Context {
  params: Promise<{
    id: string
  }>
}

/**
 * PUT /api/integrations/mixradius/groups/[id]
 * Update owner group
 */
export async function PUT(req: NextRequest, context: Context) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = await getUserPermissions(session.id)
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    
    if (!isSuperAdmin && !permissions.includes('mixradius:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await req.json()
    const { name, owners, siteId, isActive } = body

    const service = getMixRadiusService()
    const updatedGroup = await service.updateOwnerGroup(id, { name, owners, siteId, isActive })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id, changes: { name, owners, isActive } }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json(updatedGroup)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/mixradius/groups/[id]
 * Delete owner group
 */
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const permissions = await getUserPermissions(session.id)
    if (!permissions.includes('mixradius:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const service = getMixRadiusService()
    await service.deleteOwnerGroup(id)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
