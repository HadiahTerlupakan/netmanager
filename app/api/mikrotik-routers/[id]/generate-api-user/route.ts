import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/mikrotik-routers/[id]/generate-api-user
 * Generate API user untuk router yang sudah ada (tidak punya apiUsernameGenerated)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) return session
    
    const { id } = await params
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.findById(id)
    
    if (!router) {
      return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
    }

    // Import the provisioning service
    const { MikroTikProvisioningService } = await import('@/modules/network/services/MikroTikProvisioningService')
    const provisioningService = new MikroTikProvisioningService()

    console.log(`[Generate API User] Creating API user for router ${router.name} (${router.ipAddress})...`)

    // Create API user using master credentials
    const result = await provisioningService.createApiUser({
      ip: router.ipAddress,
      port: router.apiPort,
      username: router.apiUsername,
      password: router.apiPassword,
    })

    if (!result.success) {
      console.error(`[Generate API User] Failed: ${result.logs.join(', ')}`)
      return NextResponse.json({ 
        error: 'Gagal membuat API user', 
        logs: result.logs 
      }, { status: 500 })
    }

    // Save generated credentials to database
    await prisma.mikroTikRouter.update({
      where: { id: router.id },
      data: {
        apiUsernameGenerated: result.username,
        apiPasswordGenerated: result.password,
      }
    })

    console.log(`[Generate API User] Success: ${result.username}`)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'MikroTik API User',
        userId: session.user.id,
        details: { routerId: id, username: result.username }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ 
      success: true, 
      username: result.username,
      logs: result.logs 
    })
  } catch (error: any) {
    console.error('Error generating API user:', error)
    return NextResponse.json({ error: error.message || 'Gagal membuat API user' }, { status: 500 })
  }
}
