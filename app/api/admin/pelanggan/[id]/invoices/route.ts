import { prismaBilling } from '@/lib/prisma-billing'
import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (request, ctx) => {
    const tenantId = ctx.session!.user.tenantId
    const isSuperAdmin = ctx.session!.user.isSuperAdmin

    // Tenant isolation: non-superAdmin users must have a tenantId
    if (!tenantId && !isSuperAdmin) {
        return ApiErrors.forbidden('Akses ditolak: tenant tidak teridentifikasi')
    }

    const { id: pelangganId } = ctx.params

    // Verify customer exists and belongs to the caller's tenant
    const customer = await prisma.pelanggan.findUnique({
        where: {
            id: pelangganId,
            // Restrict to caller's tenant to prevent IDOR cross-tenant access.
            // SuperAdmin (no tenantId) is exempt and can access all tenants.
            ...(tenantId ? { tenantId } : {}),
        }
    })

    if (!customer) {
        return ApiErrors.notFound('Customer not found')
    }

    // Fetch invoices and their payments, scoped to caller's tenant
    const invoices = await prismaBilling.invoice.findMany({
        where: {
            pelangganId,
            ...(tenantId ? { tenantId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        include: {
            payment: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    return apiSuccess(invoices)
})
