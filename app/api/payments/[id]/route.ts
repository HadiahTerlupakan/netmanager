import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * GET /api/payments/{id}
 * Get payment by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    const payment = await prisma.payment.findUnique({
      where: { id },
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

    if (!payment) {
        return ApiErrors.notFound('Pembayaran')
    }

    return apiSuccess(payment)
})
