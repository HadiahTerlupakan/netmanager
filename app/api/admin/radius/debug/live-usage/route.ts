import { RadiusSyncService } from '@/modules/network'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!await hasPermission('radius:read')) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk debug sesi RADIUS')
  }

  const tenantId = ctx.session?.user?.tenantId
  if (!tenantId) {
    return ApiErrors.forbidden('Tenant tidak valid')
  }

  const username = (req.nextUrl.searchParams.get('username') || '').trim()
  const nasIpAddress = (req.nextUrl.searchParams.get('nasIpAddress') || '').trim()

  if (!username) {
    return ApiErrors.badRequest('Query parameter username wajib diisi')
  }

  const syncService = new RadiusSyncService()
  const result = await syncService.debugLiveSessionUsageByUsername(
    username,
    tenantId,
    nasIpAddress || undefined,
  )

  if (!result.success) {
    return ApiErrors.internalError(result.error || 'Gagal debug live usage')
  }

  return apiSuccess({
    username,
    tenantId,
    ...(nasIpAddress ? { nasIpAddress } : {}),
    routerSource: result.routerSource,
    routerId: result.routerId,
    debug: result.debug,
  })
})
