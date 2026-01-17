import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MikroTikProvisioningService } from '@/modules/network/services/MikroTikProvisioningService'

// Initialize service
const provisioningService = new MikroTikProvisioningService()

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) { // TODO: Add proper role check if needed
    return null
  }
  return session
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { routerIds } = body

    if (!Array.isArray(routerIds) || routerIds.length === 0) {
        return NextResponse.json({ error: 'No routers selected' }, { status: 400 })
    }

    // 1. Fetch Global Settings
    const settings = await prisma.settings.findMany({
        where: {
            key: { in: ['RADIUS_SECRET', 'ISOLIR_URL', 'MIKROTIK_API_URL'] } // MIKROTIK_API_URL often used as server IP fallback
        }
    });

    const radiusSecret = settings.find(s => s.key === 'RADIUS_SECRET')?.value || 'testing123'
    const isolirUrl = settings.find(s => s.key === 'ISOLIR_URL')?.value
    const serverIp = settings.find(s => s.key === 'MIKROTIK_API_URL')?.value // Or let auto-detect handle it

    // 2. Fetch Selected Routers
    const routers = await prisma.mikroTikRouter.findMany({
        where: {
            id: { in: routerIds },
            pingStatus: 'online' // Only try online routers? Or try all and fail? Better try all selected.
        }
    })

    if (routers.length === 0) {
        return NextResponse.json({ error: 'No valid routers found among selection' }, { status: 404 })
    }

    const results = []
    let successCount = 0

    // 3. Process Each Router
    for (const router of routers) {
        try {
             // Use generated credentials if available, else master
            const username = router.apiUsername
            const password = router.apiPassword

            const routerDetails = {
                ip: router.ipAddress,
                port: router.apiPort,
                username: username,
                password: password
            }

            const result = await provisioningService.provisionRadius(
                routerDetails,
                null, // Allow auto-detect IP
                radiusSecret,
                isolirUrl
            )

            results.push({
                id: router.id,
                name: router.name,
                success: result.success,
                logs: result.logs,
                error: result.success ? null : 'Provisioning failed'
            })

            if (result.success) successCount++

        } catch (error: any) {
            results.push({
                id: router.id,
                name: router.name,
                success: false,
                logs: [],
                error: error.message
            });
        }
    }

    return NextResponse.json({
        success: true,
        message: `Reconfiguration completed. ${successCount}/${routers.length} successful.`,
        results
    })

  } catch (error: any) {
    console.error('Error reconfiguring routers:', error)
    return NextResponse.json({ error: error.message || 'Failed to reconfigure routers' }, { status: 500 })
  }
}
