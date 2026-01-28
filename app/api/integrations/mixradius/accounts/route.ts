
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/mixradius/MixRadiusConfigRepository'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return ApiErrors.unauthorized()
    }

    const permissions = await getUserPermissions(auth.id)
    if (!permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden()
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

    const permissions = await getUserPermissions(auth.id)
    // Reusing create permission or generic mixradius permission
    if (!permissions.includes('mixradius:create')) {
      return ApiErrors.forbidden()
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
