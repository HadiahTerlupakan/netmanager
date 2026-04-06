import { prisma, prismaBilling } from '@/modules/database'
import { apiSuccess, createHandler, ApiErrors } from '@/lib/api'
import { canAccessSite } from '@/modules/roles'

export const GET = createHandler({ auth: true, permissions: ['pelanggan:read'] }, async (req, ctx) => {
  const { id: pelangganId } = ctx.params
  const session = ctx.session!
  const tenantId = session.user.tenantId ?? null
  const isSuperAdmin = Boolean(session.user.isSuperAdmin || session.user.role === 'SUPER_ADMIN')

  if (!tenantId && !isSuperAdmin) {
    return ApiErrors.forbidden('Akses ditolak: tenant tidak teridentifikasi')
  }

  const pelanggan = await prisma.pelanggan.findFirst({
    where: {
      id: pelangganId,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      siteId: true,
    },
  })

  if (!pelanggan) {
    return ApiErrors.notFound('Pelanggan')
  }

  if (session.user.role && session.user.role !== 'SUPER_ADMIN') {
    const hasAccess = canAccessSite(session as Parameters<typeof canAccessSite>[0], 'pelanggan', pelanggan.siteId)
    if (!hasAccess) {
      return ApiErrors.forbidden('Akses ditolak')
    }
  }

  const invoices = await prismaBilling.invoice.findMany({
    where: {
      pelangganId,
      ...(tenantId ? { tenantId } : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      status: true,
      dueDate: true,
      paidAt: true,
      createdAt: true,
      payment: {
        select: {
          paymentMethod: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  const tagihans = invoices.map(invoice => {
    let status = 'BELUM_LUNAS'
    if (invoice.status === 'PAID') status = 'LUNAS'
    else if (invoice.status === 'OVERDUE') status = 'TERLAMBAT'
    else if (invoice.status === 'CANCELLED') status = 'LUNAS'

    const date = new Date(invoice.createdAt)
    const paymentMethod = invoice.payment[0]?.paymentMethod ?? null

    return {
      id: invoice.id,
      noTagihan: invoice.invoiceNumber,
      periodeBulan: date.getMonth() + 1,
      periodeTahun: date.getFullYear(),
      subtotal: Number(invoice.subtotal),
      diskon: Number(invoice.discountAmount),
      ppn: Number(invoice.taxAmount),
      biayaInstalasi: 0,
      biayaSewaPerangkat: 0,
      biayaLainnya: 0,
      total: Number(invoice.totalAmount),
      status,
      jatuhTempo: invoice.dueDate.toISOString(),
      tanggalBayar: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      metodePembayaran: paymentMethod,
      createdAt: invoice.createdAt.toISOString()
    }
  })

  const url = new URL(req.url)
  const isLatest = url.searchParams.get('latest') === 'true'

  if (isLatest) {
    return apiSuccess({ tagihan: tagihans.length > 0 ? tagihans[0] : null })
  }

  return apiSuccess({ data: tagihans })
})
