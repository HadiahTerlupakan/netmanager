import { NextRequest } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const service = getMixRadiusService()

    // Permission Check
    // Reuse verifyAuth logic or use helper if available in this context
    // Since this is a simple route, we'll implement a basic check here or assume middleware handles it
    // But to be consistent with others, let's verify auth and permissions.

    // Note: This file uses 'getMixRadiusService' directly. Ideally it should check permissions.
    // Let's add the check.
    const { verifyAuth, getUserPermissions } = await import('@/lib/auth')
    const session = await verifyAuth(request)
    if (!session) return ApiErrors.unauthorized()

    const permissions = await getUserPermissions(session.id)
    // Check specific permission for this report
    if (!permissions.includes('mixradius_income:read') && !permissions.includes('mixradius:read')) {
       return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_income:read')
    }

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
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Unknown error')
  }
}
