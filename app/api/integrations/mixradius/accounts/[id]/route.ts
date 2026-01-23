
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/mixradius/MixRadiusConfigRepository'

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await getUserPermissions(auth.id)
    if (!permissions.includes('mixradius:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { id } = params
    
    // Validate ID
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const updatedConfig = await mixRadiusConfigRepo.updateConfig(id, body)

    await logger.logActivity({
      userId: auth.id,
      action: 'UPDATE',
      subject: 'mixradius_config',
      details: { id, changes: body },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })
    return NextResponse.json(updatedConfig)
  } catch (error) {
    console.error('[API] Error updating MixRadius config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await getUserPermissions(auth.id)
    if (!permissions.includes('mixradius:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = params
    
    // Validate ID
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    await mixRadiusConfigRepo.deleteConfig(id)

    await logger.logActivity({
      userId: auth.id,
      action: 'DELETE',
      subject: 'mixradius_config',
      details: { id },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting MixRadius config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
