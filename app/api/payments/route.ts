import { Prisma as PrismaBilling } from '@/prisma/generated/billing';

import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import { paymentSchema } from '@/lib/validations/payment'
import { randomUUID } from 'crypto'
import { apiSuccess, apiError, ApiErrors, ErrorCodes, createHandler } from '@/lib/api'
import { Prisma } from '@prisma/client'
import { logActivitySafe } from '@/lib/logger'

/**
 * GET /api/payments
 * Get all payments
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
  const { searchParams } = req.nextUrl
  const pelangganId = searchParams.get('pelangganId')
  const invoiceId = searchParams.get('invoiceId')
  const paymentMethod = searchParams.get('paymentMethod')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')

  const where: Record<string, unknown> = {}
  if (pelangganId) {
    where.pelangganId = pelangganId
  }
  if (invoiceId) {
    where.invoiceId = invoiceId
  }
  if (paymentMethod) {
    where.paymentMethod = paymentMethod
  }
  if (startDate || endDate) {
    const paymentDate: Record<string, Date> = {}
    if (startDate) {
      paymentDate.gte = new Date(startDate)
    }
    if (endDate) {
      paymentDate.lte = new Date(endDate)
    }
    where.paymentDate = paymentDate
  }

  const skip = (page - 1) * limit

  const [payments, total] = await Promise.all([
    prismaBilling.payment.findMany({
      where: where as PrismaBilling.PaymentWhereInput,
      include: { invoice: true },
      orderBy: { paymentDate: 'desc' },
      skip,
      take: limit,
    }),
    prismaBilling.payment.count({ where: where as PrismaBilling.PaymentWhereInput }),
  ])

  const totalPages = Math.ceil(total / limit)

  return apiSuccess({
    data: payments,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  })
})

/**
 * POST /api/payments
 * Record new payment
 */
export const POST = createHandler({
  auth: true,
  schema: paymentSchema
}, async (req, ctx) => {
  const { invoiceId, pelangganId, amount, ...paymentData } = ctx.validated
  const user = ctx.session!.user

  // Check if pelanggan exists
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
  })

  if (!pelanggan) {
    return ApiErrors.notFound('Pelanggan tidak ditemukan')
  }

  // If invoiceId is provided, check if invoice exists
  if (invoiceId) {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id: invoiceId },
    })

    if (!invoice) {
      return ApiErrors.notFound('Invoice tidak ditemukan')
    }
  }

  // Convert amount to BigInt (stored in whole rupiah)
  const amountInCents = BigInt(Math.round(amount))

  try {
    const payment = await prismaBilling.payment.create({
      data: {
        id: randomUUID(),
        paymentDate: new Date(paymentData.paymentDate),
        paymentMethod: paymentData.paymentMethod,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gatewayStatus: (paymentData as any).paymentStatus || 'PAID',
        reference: paymentData.reference ?? null,
        notes: paymentData.notes ?? null,
        invoiceId: invoiceId || null,
        pelangganId,
        amount: amountInCents,
        verifiedBy: user.id,
        updatedAt: new Date(),
      },
      include: { invoice: true },
    })

    // If payment is linked to an invoice, update invoice status and paid amount
    if (invoiceId) {
      const invoice = await prismaBilling.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          payment: true,
        },
      })

      if (invoice) {
        // Calculate total paid amount
        // Payment created above is already included in invoice.payment due to transaction consistency? 
        // Wait, create is done. But invoice.payment fetched might not include it if not in same transaction?
        // create happened before findUnique. It SHOULD include it.
        // But let's be safe.
        const totalPaid = invoice.payment.reduce(
          (sum, p) => sum + p.amount,
          BigInt(0)
        )

        // Update invoice paid amount and status
        await prismaBilling.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: totalPaid,
            status: totalPaid >= invoice.totalAmount
              ? 'PAID'
              : totalPaid > BigInt(0)
                ? 'PARTIAL_PAID'
                : invoice.status,
            paidAt: totalPaid >= invoice.totalAmount ? new Date() : null,
          },
        })
      }
    }

    // System Log
    logActivitySafe({
      action: 'CREATE',
      subject: 'Payment',
      userId: user.id,
      details: { id: payment.id, amount: Number(amountInCents), method: paymentData.paymentMethod }
    })

    return apiSuccess(payment, { status: 201 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Error creating payment:', error)

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return apiError('Pelanggan atau Invoice tidak ditemukan', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    return ApiErrors.internalError(error instanceof Error ? error.message : 'Terjadi kesalahan server')
  }
})
