import { syncService } from '@/modules/integrations'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { getUserPermissions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { startDate, endDate } = await req.json()

    // RBAC check
    const permissions = await getUserPermissions(user.id)
    const hasAccess = user.role === 'SUPER_ADMIN' || permissions.includes('*') || permissions.includes('mixradius:calculate') || permissions.includes('mixradius_income:calculate');

    if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius:calculate')
    }

    try {
        const result = await syncService.syncInvoices(startDate, endDate)
        return apiSuccess({
            message: `Berhasil mensinkronisasi ${result.count} data.`,
            count: result.count
        })
    } catch (error: unknown) {
        console.error('[Manual Sync API] Error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat sinkronisasi'
        return ApiErrors.internalError(errorMessage)
    }
})
