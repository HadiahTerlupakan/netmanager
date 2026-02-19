import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'
import { logActivitySafe } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/mixradius/groups
 * Get all owner groups (Sites)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

    if (!isSuper && !permissions.includes('mixradius_sites:read') && !permissions.includes('mixradius:read') && !permissions.includes('m_mixradius:read')) {
      return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_sites:read')
    }

    const service = getMixRadiusService()
    const groups = await service.getOwnerGroups()

    return apiSuccess(groups)
})

/**
 * POST /api/integrations/mixradius/groups
 * Create new owner group
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const permissions = await getUserPermissions(user.id)
    const isSuper = isSuperAdmin(user)

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
        { details: { missingFields }, status: 400 }
      )
    }

    const service = getMixRadiusService()
    const newGroup = await service.createOwnerGroup({ name, owners, siteId })

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'MixRadius Group',
      userId: user.id,
      details: { id: newGroup.id, name: newGroup.name, owners: newGroup.owners }
    })

    return apiSuccess(newGroup, { status: 201 })
})
