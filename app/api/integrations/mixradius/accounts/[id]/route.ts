
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { mixRadiusConfigRepo } from '@/modules/integrations/repositories/MixRadiusConfigRepository'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return ApiErrors.unauthorized()
    }

    const user = auth as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(auth.id)
      const hasAccess = permissions.includes('mixradius:update') || permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk update MixRadius')
      }
    }

    const body = await req.json()
    const { id } = await params
    
    // Validate ID
    if (!id) return apiError(ErrorCodes.VALIDATION_ERROR, 'ID required')

    const updatedConfig = await mixRadiusConfigRepo.updateConfig(id, body)

    await logger.logActivity({
      userId: auth.id,
      action: 'UPDATE',
      subject: 'mixradius_config',
      details: { id, changes: body },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })
    return apiSuccess(updatedConfig)
  } catch (error) {
    console.error('[API] Error updating MixRadius config:', error)
    return ApiErrors.internalError()
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(req)
    if (!auth) {
      return ApiErrors.unauthorized()
    }

    const user = auth as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(auth.id)
      const hasAccess = permissions.includes('mixradius:delete') || permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk delete MixRadius')
      }
    }

    const { id } = await params
    
    // Validate ID
    if (!id) return apiError(ErrorCodes.VALIDATION_ERROR, 'ID required')

    await mixRadiusConfigRepo.deleteConfig(id)

    await logger.logActivity({
      userId: auth.id,
      action: 'DELETE',
      subject: 'mixradius_config',
      details: { id },
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return apiSuccess({ success: true })
  } catch (error) {
    console.error('[API] Error deleting MixRadius config:', error)
    return ApiErrors.internalError()
  }
}
