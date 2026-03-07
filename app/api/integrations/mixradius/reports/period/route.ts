import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { getUserPermissions } from '@/lib/auth'
import { prismaBilling } from '@/lib/prisma-billing'
import { toEndOfDay } from '@/lib/utils/datetime'


export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const { searchParams } = req.nextUrl
  const service = getMixRadiusService()
  const user = ctx.session!.user

  const permissions = await getUserPermissions(user.id)
  const hasAccess = user.role === 'SUPER_ADMIN' || permissions.includes('*') || permissions.includes('mixradius_income:read') || permissions.includes('mixradius:read');

  if (!hasAccess) {
    return ApiErrors.forbidden('Akses ditolak. Anda memerlukan permission: mixradius_income:read')
  }

  const start = parseInt(searchParams.get('start') || '0')
  const length = parseInt(searchParams.get('length') || '10')
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || 'issuedDate'
  const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc'
  const startDateStr = searchParams.get('fdate')
  const endDateStr = searchParams.get('tdate')
  const source = searchParams.get('source') || 'api' // Default to external API

  // If source is local, fetch from prismaBilling.mixRadiusInvoice
  if (source === 'local') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        status: 'PAID',
      }

      if (startDateStr) {
        where.issuedDate = { ...where.issuedDate, gte: new Date(startDateStr) }
      }
      if (endDateStr) {
        const end = new Date(endDateStr)
        end.setTime(toEndOfDay(end).getTime())
        where.issuedDate = { ...where.issuedDate, lte: end }
      }
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
        ]
      }

      const groupId = searchParams.get('groupId')
      if (groupId && groupId !== 'all') {
        const group = await prismaBilling.mixRadiusOwnerGroup.findUnique({ where: { id: groupId } })
        if (group && group.owners.length > 0) {
          where.ownerName = { in: group.owners }
        }
      }

      const [count, invoices] = await Promise.all([
        prismaBilling.mixRadiusInvoice.count({ where }),
        prismaBilling.mixRadiusInvoice.findMany({
          where,
          skip: start,
          take: length,
          orderBy: { [sortBy === 'renewed_on' ? 'issuedDate' : sortBy]: sortDir }
        })
      ])

      // Map to expected format
      const data = invoices.map(inv => ({
        id: inv.id,
        invoice: inv.invoiceNumber,
        username: inv.username,
        fullname: inv.fullName,
        plan_name: inv.planName,
        total: String(inv.amount),
        trx_status: inv.status,
        payment_method: inv.paymentMethod,
        renewed_on: inv.issuedDate.toISOString().replace('T', ' ').substring(0, 19),
        expired_on: inv.expiredOn?.toISOString().replace('T', ' ').substring(0, 19),
        owner_name: inv.ownerName
      }))

      // Aggregate summary
      const totalProfit = await prismaBilling.mixRadiusInvoice.aggregate({
        where,
        _sum: { amount: true }
      })

      return apiSuccess({
        data,
        recordsTotal: count,
        recordsFiltered: count,
        summary: {
          profit: String(totalProfit._sum.amount || 0),
          feeSeller: '0', // Calculation moved to client
          totalTransactions: String(count)
        }
      })
    } catch (err) {
      console.error('[Settlement API] Local fetch error:', err)
      // Fallback to API if local fails
    }
  }

  // Original external API logic
  const params = {
    start,
    length,
    search,
    sortBy,
    sortDir,
    startDate: startDateStr || undefined,
    endDate: endDateStr || undefined,
    serviceType: searchParams.get('stype') || undefined,
    paymentMethod: searchParams.get('payment_method') || undefined,
    ownerId: searchParams.get('owner_id') || undefined,
    groupId: searchParams.get('groupId') || undefined,
    siteId: searchParams.get('siteId') || undefined,
  }

  try {
    const [data, summary] = await Promise.all([
      service.fetchIncomeByPeriod(params),
      service.fetchIncomeSummary(params)
    ])

    return apiSuccess({ ...data, summary })
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'MixRadiusConfigError') {
      return apiSuccess({
        error: error.message,
        isConfigError: true,
        data: [],
        recordsTotal: 0,
        recordsFiltered: 0,
        summary: {
          profit: '0',
          feeSeller: '0',
          totalPlusPpn: '0',
          totalTransactions: '0'
        }
      })
    }
    throw error
  }
})
