
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

interface Context {
  params: Promise<{
    id: string
  }>
}

/**
 * PUT /api/integrations/mixradius/groups/[id]
 * Update owner group
 */
export async function PUT(req: NextRequest, context: Context) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    const isSuper = isSuperAdmin(session)

    if (!isSuper && !permissions.includes('mixradius:update')) {
      return ApiErrors.forbidden()
    }

    const { id } = await context.params
    const body = await req.json()
    const { name, owners, siteId, isActive } = body

    const service = getMixRadiusService()
    const updatedGroup = await service.updateOwnerGroup(id, { name, owners, siteId, isActive })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id, changes: { name, owners, isActive } }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess(updatedGroup)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return ApiErrors.internalError(message)
  }
}

/**
 * DELETE /api/integrations/mixradius/groups/[id]
 * Delete owner group
 */
export async function DELETE(req: NextRequest, context: Context) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    const isSuper = isSuperAdmin(session)

    if (!isSuper && !permissions.includes('mixradius:delete') && !permissions.includes('*')) {
      return ApiErrors.forbidden()
    }

    const { id } = await context.params
    const service = getMixRadiusService()
    await service.deleteOwnerGroup(id)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return ApiErrors.internalError(message)
  }
}
