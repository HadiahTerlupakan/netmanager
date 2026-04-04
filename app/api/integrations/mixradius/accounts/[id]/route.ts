import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user
  const isSuper = isSuperAdmin(user)

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id)
    const hasAccess = permissions.includes('mixradius:update') || permissions.includes('*')
    if (!hasAccess) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk update MixRadius')
    }
  }

  const body = await req.json()
  const { id } = ctx.params

  if (!id) return apiError('ID akun wajib disertakan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

  // Map baseUrl (UI) to apiUrl (DB) if needed
  if (body.baseUrl && !body.apiUrl) {
    body.apiUrl = body.baseUrl
  }

  if (body.baseUrl) {
    delete body.baseUrl
  }

  // Map isActive (UI) to isDefault (DB)
  if (body.isActive !== undefined && body.isDefault === undefined) {
    body.isDefault = body.isActive
  }

  if (body.isActive !== undefined) {
    delete body.isActive
  }

  const updatedConfig = await mixRadiusConfigRepo.updateConfig(id, body)

  await logger.logActivity({
    userId: user.id,
    action: 'UPDATE',
    subject: 'mixradius_config',
    details: { id, changes: body },
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
  })
  return apiSuccess(updatedConfig)
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const user = ctx.session!.user
  const isSuper = isSuperAdmin(user)

  if (!isSuper) {
    const permissions = await getUserPermissions(user.id)
    const hasAccess = permissions.includes('mixradius:delete') || permissions.includes('*')
    if (!hasAccess) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk delete MixRadius')
    }
  }

  const { id } = ctx.params

  if (!id) return apiError('ID akun wajib disertakan', ErrorCodes.VALIDATION_ERROR, { status: 400 })

  await mixRadiusConfigRepo.deleteConfig(id)

  await logger.logActivity({
    userId: user.id,
    action: 'DELETE',
    subject: 'mixradius_config',
    details: { id },
    ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
    userAgent: req.headers.get('user-agent') || 'unknown',
  })

  return apiSuccess({ success: true })
})
