
import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/mixradius/groups
 * Get all owner groups (Sites)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    const isSuper = isSuperAdmin(session)

    if (!isSuper && !permissions.includes('mixradius_sites:read') && !permissions.includes('mixradius:read')) {
      return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_sites:read')
    }

    const service = getMixRadiusService()
    const groups = await service.getOwnerGroups()

    return apiSuccess(groups)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}

/**
 * POST /api/integrations/mixradius/groups
 * Create new owner group
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    const isSuper = isSuperAdmin(session)

    if (!isSuper && !permissions.includes('mixradius_sites:create') && !permissions.includes('mixradius:create')) {
      return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_sites:create')
    }

    const body = await req.json()
    const { name, owners, siteId } = body

    if (!name || !owners || !Array.isArray(owners)) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Invalid data')
    }

    const service = getMixRadiusService()
    const newGroup = await service.createOwnerGroup({ name, owners, siteId })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'MixRadius Group',
        userId: session.id,
        details: { id: newGroup.id, name: newGroup.name, owners: newGroup.owners }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess(newGroup, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}
