import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

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

    const body = await req.json()
    const customerIds: string[] = body.customerIds || []
    const validationData: Record<string, string> = body.validationData || {}
    const bypassCache: boolean = body.bypassCache || false

    if (customerIds.length === 0) {
      return apiSuccess({ data: {} })
    }

    // Limit to max 20 customers per request if not bypassing
    // If bypassing, we still want to be careful
    const limitedIds = customerIds.slice(0, 20)

    const service = new MixRadiusService()
    const results = await service.fetchInvoiceCounts(limitedIds, bypassCache, validationData)

    // Convert Map to object for JSON response
    const data: Record<string, { paidCount: number, totalCount: number }> = {}
    results.forEach((value, key) => {
      data[key] = value
    })

    return apiSuccess({ data })
  } catch (error: any) {
    console.error('[API] Invoice counts error:', error)
    return ApiErrors.internalError(error.message || 'Internal Server Error')
  }
}
