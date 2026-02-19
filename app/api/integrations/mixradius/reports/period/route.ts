import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { getUserPermissions } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { searchParams } = req.nextUrl
    const service = getMixRadiusService()
    const user = ctx.session!.user

    const permissions = await getUserPermissions(user.id)
    // Check specific permission for this report
    const hasAccess = user.role === 'SUPER_ADMIN' || permissions.includes('*') || permissions.includes('mixradius_income:read') || permissions.includes('mixradius:read');
    
    if (!hasAccess) {
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
})
