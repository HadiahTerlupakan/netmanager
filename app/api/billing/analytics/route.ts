import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Invoice, Payment } from '@prisma/client'

/**
 * @swagger
 * /api/billing/analytics:
 *   get:
 *     summary: Get billing analytics and statistics
 *     description: Mengambil analytics dan statistik billing
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: ["TODAY", "WEEK", "MONTH", "QUARTER", "YEAR"]
 *           default: "MONTH"
 *         description: Periode analytics
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal mulai (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Tanggal akhir (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Analytics berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary:
 *                   type: object
 *                   properties:
 *                     totalInvoices:
 *                       type: integer
 *                       description: Total invoice
 *                     totalRevenue:
 *                       type: number
 *                       description: Total pendapatan
 *                     totalPayments:
 *                       type: integer
 *                       description: Total pembayaran
 *                     totalPaid:
 *                       type: number
 *                       description: Total yang sudah dibayar
 *                     outstandingAmount:
 *                       type: number
 *                       description: Total yang belum dibayar
 *                     averageInvoiceValue:
 *                       type: number
 *                       description: Rata-rata nilai invoice
 *                 paymentMethods:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       method:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       total:
 *                         type: number
 *                   description: Statistik metode pembayaran
 *                 invoiceStatuses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                       count:
 *                         type: integer
 *                       total:
 *                         type: number
 *                   description: Statistik status invoice
 *                 monthlyTrend:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       month:
 *                         type: string
 *                       invoices:
 *                         type: integer
 *                       revenue:
 *                         type: number
 *                   description: Tren bulanan
 *                 topCustomers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       totalPaid:
 *                         type: number
 *                       invoiceCount:
 *                         type: integer
 *                   description: Pelanggan teratas
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const period = searchParams.get('period') || 'MONTH'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Calculate date range based on period
    const now = new Date()
    let dateStart: Date
    let dateEnd: Date = now

    if (startDate && endDate) {
      dateStart = new Date(startDate)
      dateEnd = new Date(endDate)
    } else {
      switch (period) {
        case 'TODAY':
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'WEEK':
          dateStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'MONTH':
          dateStart = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'QUARTER':
          const quarter = Math.floor(now.getMonth() / 3)
          dateStart = new Date(now.getFullYear(), quarter * 3, 1)
          break
        case 'YEAR':
          dateStart = new Date(now.getFullYear(), 0, 1)
          break
        default:
          dateStart = new Date(now.getFullYear(), now.getMonth(), 1)
      }
    }

    // Get invoices summary
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      include: {
        payments: true,
        pelanggan: true,
      },
    }) as (Invoice & { payments: Payment[]; pelanggan: any })[]

    // Calculate summary
    const totalInvoices = invoices.length
    const totalRevenue = invoices.reduce((sum: number, inv: Invoice & { payments: Payment[]; pelanggan: any }) => sum + Number(inv.totalAmount) / 100, 0)
    const totalPayments = invoices.reduce((sum: number, inv: Invoice & { payments: Payment[]; pelanggan: any }) => sum + inv.payments.length, 0)
    const totalPaid = invoices.reduce((sum: number, inv: Invoice & { payments: Payment[]; pelanggan: any }) => {
      const paid = inv.payments.reduce((pSum: number, p: Payment) => pSum + Number(p.amount) / 100, 0)
      return sum + paid
    }, 0)
    const outstandingAmount = totalRevenue - totalPaid
    const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

    // Get payment methods statistics
    const allPayments = await prisma.payment.findMany({
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
    })

    const paymentMethods = allPayments.reduce((acc, payment) => {
      const method = payment.paymentMethod
      if (!acc[method]) {
        acc[method] = { method, count: 0, total: 0 }
      }
      acc[method].count += 1
      acc[method].total += Number(payment.amount) / 100
      return acc
    }, {} as Record<string, { method: string; count: number; total: number }>)

    // Get invoice status statistics
    const invoiceStatuses = invoices.reduce((acc: Record<string, { status: string; count: number; total: number }>, invoice: Invoice & { payments: Payment[]; pelanggan: any }) => {
      const status = invoice.status
      if (!acc[status]) {
        acc[status] = { status, count: 0, total: 0 }
      }
      acc[status].count += 1
      acc[status].total += Number(invoice.totalAmount) / 100
      return acc
    }, {} as Record<string, { status: string; count: number; total: number }>)

    // Get monthly trend (last 12 months)
    const monthlyTrend = []
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
      
      const monthInvoices = await prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: monthDate,
            lt: monthEnd,
          },
        },
      })

      const monthInvoicesForTrend = await prisma.invoice.findMany({
        where: {
          createdAt: {
            gte: monthDate,
            lt: monthEnd,
          },
        },
      })

      const monthRevenue = monthInvoicesForTrend.reduce((sum: number, inv: Invoice) => sum + Number(inv.totalAmount) / 100, 0)
      const monthName = monthDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

      monthlyTrend.push({
        month: monthName,
        invoices: monthInvoices.length,
        revenue: monthRevenue,
      })
    }

    // Get top customers by payment amount
    const customerPayments = await prisma.payment.groupBy({
      by: ['pelangganId'],
      where: {
        paymentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _sum: {
          amount: 'desc',
        },
      },
      take: 10,
    })

    const topCustomers = await Promise.all(
      customerPayments.map(async (cp) => {
        const pelanggan = await prisma.pelanggan.findUnique({
          where: { id: cp.pelangganId },
          select: {
            id: true,
            nama: true,
          },
        })

        return {
          id: cp.pelangganId,
          name: pelanggan?.nama || 'Unknown',
          totalPaid: Number(cp._sum.amount) / 100,
          invoiceCount: cp._count.id,
        }
      })
    )

    return NextResponse.json({
      summary: {
        totalInvoices,
        totalRevenue,
        totalPayments,
        totalPaid,
        outstandingAmount,
        averageInvoiceValue,
        period: {
          start: dateStart.toISOString(),
          end: dateEnd.toISOString(),
          type: startDate && endDate ? 'CUSTOM' : period,
        },
      },
      paymentMethods: Object.values(paymentMethods),
      invoiceStatuses: Object.values(invoiceStatuses),
      monthlyTrend,
      topCustomers,
    })
  } catch (error: any) {
    console.error('Error fetching billing analytics:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}