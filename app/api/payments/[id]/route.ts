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

    // Ownership Check
    const user = ctx.session?.user
    if (user && !user.isSuperAdmin) {
      // Check if payment belongs to user's site (via invoice) or tenant
      const paymentSiteId = payment.invoice?.siteId
      const paymentTenantId = payment.tenantId

      const belongsToSite = user.siteId && paymentSiteId === user.siteId
      const belongsToTenant = user.tenantId && paymentTenantId === user.tenantId
      
      // If payment has siteId, it must match user's siteId
      // If no siteId, fallback to tenant check
      if (paymentSiteId) {
        if (!belongsToSite) {
          return ApiErrors.forbidden('Akses ditolak. Pembayaran ini bukan milik site Anda.')
        }
      } else if (paymentTenantId) {
        if (!belongsToTenant) {
          return ApiErrors.forbidden('Akses ditolak. Pembayaran ini bukan milik tenant Anda.')
        }
      }
    }

    return apiSuccess(payment)
})
