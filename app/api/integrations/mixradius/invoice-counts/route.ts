import { NextRequest } from 'next/server'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

/**
 * POST /api/integrations/mixradius/invoice-counts
 *
 * Batch fetch invoice counts for multiple customers
 * Body: { customerIds: string[] }
 * Returns: { [customerId]: { paidCount: number, totalCount: number } }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    // Permission check
    const user = session as { id: string; role?: string; isSuperAdmin?: boolean }
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

    // Limit to max 20 customers per request if not bypassing
    // If bypassing, we still want to be careful
    const limitedIds = customerIds.slice(0, 20)

    const service = getMixRadiusService()
    const results = await service.fetchInvoiceCounts(limitedIds, bypassCache, validationData)

    // Convert Map to object for JSON response
    const data: Record<string, { paidCount: number, totalCount: number }> = {}
    results.forEach((value: { paidCount: number; totalCount: number }, key: string) => {
      data[key] = value
    })

    return apiSuccess(data)
  } catch (error: unknown) {
    console.error('[API] Invoice counts error:', error)
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan server'
    return ApiErrors.internalError(message)
  }
}
