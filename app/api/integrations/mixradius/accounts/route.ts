import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/repositories/MixRadiusConfigRepository'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('mixradius_accounts:read') ||
                        permissions.includes('mixradius:read') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_accounts:read')
      }
    }

    const configs = await mixRadiusConfigRepo.getAllConfigs()
    return apiSuccess(configs)
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('mixradius_accounts:create') ||
                        permissions.includes('mixradius:create') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_accounts:create')
      }
    }

    const body = await req.json()
    const { name, baseUrl, username, password, isActive } = body

    const missingFields: string[] = []
    if (!name) missingFields.push('Nama Akun')
    if (!baseUrl) missingFields.push('Base URL')
    if (!username) missingFields.push('Username')
    if (!password) missingFields.push('Password')

    if (missingFields.length > 0) {
      return apiError(
        `Data berikut wajib diisi: ${missingFields.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR,
        { details: { missingFields }, status: 400 }
      )
    }

    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      return apiError(
        'Base URL harus diawali dengan http:// atau https://',
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 }
      )
    }

    const newConfig = await mixRadiusConfigRepo.createConfig({
      name,
      baseUrl,
      username,
      password,
      isActive: isActive || false,
    })

    await logger.logActivity({
      userId: user.id,
      action: 'CREATE',
      subject: 'mixradius_config',
      details: { id: newConfig.id, name: newConfig.name },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return apiSuccess(newConfig, { status: 201 })
})
