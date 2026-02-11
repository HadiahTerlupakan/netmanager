
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
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
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

    const missingFields: string[] = []
    if (!name || !name.trim()) missingFields.push('Nama Site')
    if (!owners || !Array.isArray(owners) || owners.length === 0) missingFields.push('Owner (minimal 1)')

    if (missingFields.length > 0) {
      return apiError(
        `Data berikut wajib diisi: ${missingFields.join(', ')}`,
        ErrorCodes.VALIDATION_ERROR,
        { details: { missingFields } }
      )
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
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return ApiErrors.internalError(message)
  }
}
