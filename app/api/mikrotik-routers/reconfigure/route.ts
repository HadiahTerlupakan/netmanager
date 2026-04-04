import { prisma } from '@/modules/database'
import { MikroTikProvisioningService } from '@/modules/network'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'

// Initialize service
const provisioningService = new MikroTikProvisioningService()

export const POST = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission("mikrotik:update")) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const body = await req.json()
    const { routerIds } = body

    if (!Array.isArray(routerIds) || routerIds.length === 0) {
        return apiError('No routers selected', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // 1. Fetch Global Settings
    const settings = await prisma.settings.findMany({
        where: {
            key: { in: ['RADIUS_SECRET', 'ISOLIR_URL', 'MIKROTIK_API_URL'] }
        }
    });

    const radiusSecret = settings.find(s => s.key === 'RADIUS_SECRET')?.value || 'testing123'
    const isolirUrl = settings.find(s => s.key === 'ISOLIR_URL')?.value

    // 2. Fetch Selected Routers
    // TODO: Add site restriction check here if needed (fetch user siteId and filter routers)
    const routers = await prisma.mikroTikRouter.findMany({
        where: {
            id: { in: routerIds },
            pingStatus: 'online'
        }
    })

    if (routers.length === 0) {
        return ApiErrors.notFound('No valid routers found among selection')
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

        } catch (error: unknown) {
            results.push({
                id: router.id,
                name: router.name,
                success: false,
                logs: [],
                error: error instanceof Error ? error.message : 'Terjadi kesalahan'
            });
        }
    }

    return apiSuccess({
        success: true,
        message: `Reconfiguration completed. ${successCount}/${routers.length} successful.`,
        results
    })
})
