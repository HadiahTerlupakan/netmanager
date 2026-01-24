import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { MixRadiusService } from '@/modules/integrations/mixradius/MixRadiusService'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const customerIds: string[] = body.customerIds || []

    if (customerIds.length === 0) {
      return NextResponse.json({ data: {} })
    }

    // Limit to max 20 customers per request to prevent overload
    const limitedIds = customerIds.slice(0, 20)

    const service = new MixRadiusService()
    const results = await service.fetchInvoiceCounts(limitedIds)

    // Convert Map to object for JSON response
    const data: Record<string, { paidCount: number, totalCount: number }> = {}
    results.forEach((value, key) => {
      data[key] = value
    })

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('[API] Invoice counts error:', error)
    return NextResponse.json({ 
      error: error.message,
      data: {}
    }, { status: 500 })
  }
}
