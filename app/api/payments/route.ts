import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { paymentSchema } from '@/lib/validations/payment'
import { randomUUID } from 'crypto'
import { apiSuccess, apiError, ApiErrors, ErrorCodes } from '@/lib/api-response'
import { Prisma } from '@prisma/client'

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get all payments
 *     description: Mengambil daftar semua pembayaran dengan filter dan pagination
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: pelangganId
 *         schema:
 *           type: string
 *         description: Filter by pelanggan ID
 *       - in: query
 *         name: invoiceId
 *         schema:
 *           type: string
 *         description: Filter by invoice ID
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: ["CASH", "BANK_TRANSFER", "E_WALLET", "CREDIT_CARD", "DEBIT_CARD", "CHECK", "OTHER"]
 *         description: Filter by payment method
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter start date (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter end date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Daftar pembayaran berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
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
    const session = await getServerSession(authConfig)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const { searchParams } = new URL(req.url)
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
      prisma.payment.findMany({
        where: where as Prisma.PaymentWhereInput,
        include: {
          invoice: {
            include: {
              pelanggan: {
                include: {
                  hargaPaket: true,
                },
              },
            },
          },
        },
        orderBy: { paymentDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: where as Prisma.PaymentWhereInput }),
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
  } catch (error) {
    console.error('Error fetching payments:', error)
    return apiError(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Terjadi kesalahan server')
  }
}

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Record new payment
 *     description: Mencatat pembayaran baru
 *     tags: [Billing]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pelangganId
 *               - amount
 *               - paymentDate
 *               - paymentMethod
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: ID invoice (opsional)
 *               pelangganId:
 *                 type: string
 *                 example: "clx1234567890"
 *                 description: ID pelanggan
 *               amount:
 *                 type: number
 *                 example: 150000
 *                 description: Jumlah pembayaran
 *               paymentDate:
 *                 type: string
 *                 format: date
 *                 example: "2023-12-01"
 *                 description: Tanggal pembayaran
 *               paymentMethod:
 *                 type: string
 *                 enum: ["CASH", "BANK_TRANSFER", "E_WALLET", "CREDIT_CARD", "DEBIT_CARD", "CHECK", "OTHER"]
 *                 description: Metode pembayaran
 *               reference:
 *                 type: string
 *                 description: Nomor referensi
 *               notes:
 *                 type: string
 *                 description: Catatan pembayaran
 *     responses:
 *       201:
 *         description: Pembayaran berhasil dicatat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         description: Validation error atau pelanggan tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    if (!session?.user?.id) {
      return ApiErrors.unauthorized()
    }

    const body = await req.json()
    const validation = paymentSchema.safeParse(body)

    if (!validation.success) {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Validasi gagal', { details: validation.error.flatten() })
    }

    const { invoiceId, pelangganId, amount, ...paymentData } = validation.data

    // Check if pelanggan exists
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
    })

    if (!pelanggan) {
      return ApiErrors.notFound('Pelanggan tidak ditemukan')
    }

    // If invoiceId is provided, check if invoice exists
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      })

      if (!invoice) {
        return ApiErrors.notFound('Invoice tidak ditemukan')
      }
    }

    // Convert amount to BigInt (stored in cents)
    const amountInCents = BigInt(Math.round(amount * 100)) / 100n

    const payment = await prisma.payment.create({
      data: {
        id: randomUUID(),
        paymentDate: paymentData.paymentDate,
        paymentMethod: paymentData.paymentMethod,
        reference: paymentData.reference ?? null,
        notes: paymentData.notes ?? null,
        invoiceId: invoiceId || null,
        pelangganId,
        amount: amountInCents,
        verifiedBy: session.user.id,
        updatedAt: new Date(),
      },
      include: {
        invoice: {
          include: {
            pelanggan: {
              include: {
                hargaPaket: true,
              },
            },
          },
        },
      },
    })

    // If payment is linked to an invoice, update invoice status and paid amount
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          payment: true,
        },
      })

      if (invoice) {
        // Calculate total paid amount
        // NOTE: Payment baru sudah dicreate di atas dan sudah termasuk dalam invoice.payment
        // Jangan tambah amountInCents lagi untuk menghindari double counting
        const totalPaid = invoice.payment.reduce(
          (sum, p) => sum + p.amount,
          0n
        )

        // Update invoice paid amount and status
        // Status: PAID jika lunas, tetap SENT jika ada pembayaran parsial
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: totalPaid,
            status: totalPaid >= invoice.totalAmount ? 'PAID' : invoice.status,
            paidAt: totalPaid >= invoice.totalAmount ? new Date() : null,
          },
        })
      }
    }

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Payment',
        userId: session.user.id,
        details: { id: payment.id, amount: Number(amountInCents) / 100, method: paymentData.paymentMethod }
      })
    } catch (_e) {
      console.error('Logging failed', _e)
    }

    return apiSuccess(payment, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating payment:', error)

    // Handle foreign key constraint violation
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return apiError(ErrorCodes.VALIDATION_ERROR, 'Pelanggan atau Invoice tidak ditemukan')
    }

    return apiError(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Terjadi kesalahan server')
  }
}