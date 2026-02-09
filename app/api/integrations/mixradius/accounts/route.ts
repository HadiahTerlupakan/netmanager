
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/repositories/MixRadiusConfigRepository'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return ApiErrors.unauthorized()
    }

    const user = auth as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(auth.id)
      const hasAccess = permissions.includes('mixradius_accounts:read') ||
                        permissions.includes('mixradius:read') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_accounts:read')
      }
    }

    const configs = await mixRadiusConfigRepo.getAllConfigs()
    return apiSuccess(configs)
  } catch (error) {
    console.error('[API] Error fetching MixRadius configs:', error)
    return ApiErrors.internalError()
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return ApiErrors.unauthorized()
    }

    const user = auth as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(auth.id)
      const hasAccess = permissions.includes('mixradius_accounts:create') ||
                        permissions.includes('mixradius:create') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_accounts:create')
      }
    }

    const body = await req.json()
    const { name, baseUrl, username, password, isActive } = body

    if (!name || !baseUrl || !username || !password) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Missing required fields')
    }

    const newConfig = await mixRadiusConfigRepo.createConfig({
      name,
      baseUrl,
      username,
      password,
      isActive: isActive || false,
    })

    await logger.logActivity({
      userId: auth.id,
      action: 'CREATE',
      subject: 'mixradius_config',
      details: { id: newConfig.id, name: newConfig.name },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return apiSuccess(newConfig, { status: 201 })
  } catch (error) {
    console.error('[API] Error creating MixRadius config:', error)
    return ApiErrors.internalError()
  }
}
