import { checkAllMikroTikRouterStatus } from '@/modules/network'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'

export const POST = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission("mikrotik:read")) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    try {
        const count = await checkAllMikroTikRouterStatus()
        return apiSuccess({
            success: true,
            message: `Status check completed. Updated ${count} routers.`,
            count,
        })
    } catch (error: unknown) {
        console.error('Error checking MikroTik router status:', error)
        const message = error instanceof Error ? error.message : 'Failed to check router status'
        return ApiErrors.internalError(message)
    }
})
