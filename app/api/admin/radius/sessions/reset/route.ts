import { RadiusSyncService } from '@/modules/network'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!await hasPermission('radius:update')) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk reset sesi RADIUS')
  }

  const body = await req.json()
  const username = typeof body?.username === 'string' ? body.username.trim() : ''

  if (!username) {
    return ApiErrors.badRequest('Username wajib diisi')
  }

  const tenantId = ctx.session?.user?.tenantId
  if (!tenantId) {
    return ApiErrors.forbidden('Tenant tidak valid')
  }

  const syncService = new RadiusSyncService()
  const result = await syncService.disconnectSessionByUsername(username, tenantId)

  if (!result.success) {
    if (result.error === 'Pelanggan tidak ditemukan untuk tenant ini') {
      return ApiErrors.notFound('Pelanggan')
    }

    if (result.error === 'Router pelanggan tidak ditemukan') {
      return ApiErrors.badRequest(result.error)
    }

    return ApiErrors.internalError(result.error || 'Gagal reset koneksi')
  }

  return apiSuccess({
    username,
    disconnected: result.disconnected,
    ...(result.pelangganId ? { pelangganId: result.pelangganId } : {}),
  }, {
    message: `Reset koneksi ${username} berhasil`,
  })
})
