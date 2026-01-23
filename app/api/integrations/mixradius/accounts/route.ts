
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/mixradius/MixRadiusConfigRepository'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await getUserPermissions(auth.id)
    if (!permissions.includes('mixradius:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configs = await mixRadiusConfigRepo.getAllConfigs()
    return NextResponse.json(configs)
  } catch (error) {
    console.error('[API] Error fetching MixRadius configs:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permissions = await getUserPermissions(auth.id)
    // Reusing create permission or generic mixradius permission
    if (!permissions.includes('mixradius:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { name, baseUrl, username, password, isActive } = body

    if (!name || !baseUrl || !username || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newConfig = await mixRadiusConfigRepo.createConfig({
      name,
      baseUrl,
      username,
      password,
      isActive: isActive || false,
    })

    await logger.logActivity({
      userId: auth.id,
      action: 'CREATE',
      subject: 'mixradius_config',
      details: { id: newConfig.id, name: newConfig.name },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json(newConfig)
  } catch (error) {
    console.error('[API] Error creating MixRadius config:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
