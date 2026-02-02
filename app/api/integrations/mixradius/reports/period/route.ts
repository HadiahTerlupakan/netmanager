import { NextRequest } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, apiError } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = getMixRadiusService()

    const params = {
      start: parseInt(searchParams.get('start') || '0'),
      length: parseInt(searchParams.get('length') || '10'),
      search: searchParams.get('search') || '',
      sortBy: searchParams.get('sortBy') || 'renewed_on',
      sortDir: (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc',
      startDate: searchParams.get('fdate') || undefined,
      endDate: searchParams.get('tdate') || undefined,
      serviceType: searchParams.get('stype') || undefined,
      paymentMethod: searchParams.get('payment_method') || undefined,
      ownerId: searchParams.get('owner_id') || undefined,
      groupId: searchParams.get('groupId') || undefined,
      siteId: searchParams.get('siteId') || undefined,
    }

    const [data, summary] = await Promise.all([
      service.fetchIncomeByPeriod(params),
      service.fetchIncomeSummary(params)
    ])

    return apiSuccess({ ...data, summary })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'Unknown error')
  }
}
