import { prismaBilling } from '@/lib/prisma-billing';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

/**
 * GET /api/payments/{id}
 * Get payment by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    const payment = await prismaBilling.payment.findUnique({
      where: { id },
      include: { invoice: true } })

    if (!payment) {
        return ApiErrors.notFound('Pembayaran')
    }

    return apiSuccess(payment)
})
