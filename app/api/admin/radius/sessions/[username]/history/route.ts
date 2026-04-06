import { RadiusSyncService } from '@/modules/network'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  if (!await hasPermission('radius:read')) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat histori sesi RADIUS')
  }

  const tenantId = ctx.session?.user?.tenantId
  if (!tenantId) {
    return ApiErrors.forbidden('Tenant tidak valid')
  }

  const username = (ctx.params?.username || '').trim()
  if (!username) {
    return ApiErrors.badRequest('Username tidak valid')
  }

  const searchParams = req.nextUrl.searchParams
  const pageParam = searchParams.get('page')
  const limitParam = searchParams.get('limit')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const page = pageParam ? Number(pageParam) : 1
  const limit = limitParam ? Number(limitParam) : 20

  if (!Number.isFinite(page) || page < 1) {
    return ApiErrors.badRequest('Query parameter page tidak valid')
  }

  if (!Number.isFinite(limit) || limit < 1) {
    return ApiErrors.badRequest('Query parameter limit tidak valid')
  }

  const syncService = new RadiusSyncService()
  const hasAccess = await syncService.canGetHistoryForRadiusDashboardUser(username, tenantId)
  if (!hasAccess) {
    return ApiErrors.notFound('Histori user tidak ditemukan')
  }

  const history = await syncService.getHistoryForRadiusDashboardUser(username, tenantId, {
    page,
    limit,
    startDate,
    endDate,
  })

  return apiSuccess({
    ...history,
    period: {
      startDate,
      endDate,
    },
  })
})
