import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { logActivitySafe } from '@/lib/logger'
import { getTenantIdFromContext } from '@/lib/tenant-context'
import {
    paymentGatewayConfigSchema,
    type PaymentGatewayConfigInput,
} from '@/lib/validations/settings'
import { getPaymentGatewayConfigService } from '@/modules/finance'

const service = getPaymentGatewayConfigService()

export const PUT = createHandler({
    auth: true,
    schema: paymentGatewayConfigSchema,
}, async (req, ctx) => {
    if (!await hasPermission('payment_gateway:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah payment gateway');
    }

    const { tenantId } = await getTenantIdFromContext();
    if (!tenantId) {
        return ApiErrors.badRequest('Tenant ID tidak ditemukan');
    }

    const { provider } = ctx.params;
    const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
    const result = await service.upsertConfig({
        provider,
        tenantId,
        input: ctx.validated as PaymentGatewayConfigInput,
        appBaseUrl,
    })
    if (!result.success) {
        return ApiErrors.badRequest(result.error)
    }

    const config = result.data

    // System Log
    logActivitySafe({
        action: 'UPDATE',
        subject: 'Payment Gateway Config',
        userId: ctx.session!.user.id,
        details: { id: config.id, provider: config.provider, isEnabled: config.isEnabled }
    })

    return apiSuccess(config, { message: 'Konfigurasi payment gateway berhasil diperbarui' })
})
