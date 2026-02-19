import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/mixradius/invoice-counts
 * Batch fetch invoice counts for multiple customers
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
      const hasAccess = permissions.includes('mixradius:read') ||
                        permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke data MixRadius')
      }
    }

    const body = await req.json()
    const customerIds: string[] = body.customerIds || []
    const validationData: Record<string, string> = body.validationData || {}
    const bypassCache: boolean = body.bypassCache || false

    if (customerIds.length === 0) {
      return apiSuccess({})
    }

    const limitedIds = customerIds.slice(0, 20)

    const service = getMixRadiusService()
    const results = await service.fetchInvoiceCounts(limitedIds, bypassCache, validationData)

    const data: Record<string, { paidCount: number, totalCount: number }> = {}
    results.forEach((value: { paidCount: number; totalCount: number }, key: string) => {
      data[key] = value
    })

    return apiSuccess(data)
})
