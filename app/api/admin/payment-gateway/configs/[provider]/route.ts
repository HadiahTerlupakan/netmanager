import { randomUUID } from 'crypto'
import { prismaBilling } from '@/lib/prisma-billing';
import { encryptApiKey } from '@/lib/utils/encryption'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { logActivitySafe } from '@/lib/logger'

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('payment_gateway:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah payment gateway');
    }

    const { provider } = ctx.params;
    const body = await req.json()

    const {
        isEnabled,
        isProduction,
        priority,
        apiKey,
        apiSecret,
        clientKey,
        merchantId,
        settings
    } = body

    // Encrypt API keys if provided
    const encryptedApiKey = apiKey ? encryptApiKey(apiKey) : undefined
    const encryptedApiSecret = apiSecret ? encryptApiKey(apiSecret) : undefined

    // Upsert configuration
    const config = await prismaBilling.paymentGatewayConfig.upsert({
        where: { provider },
        create: {
            id: randomUUID(),
            provider,
            providerName: provider.charAt(0) + provider.slice(1).toLowerCase(),
            isEnabled: isEnabled || false,
            isProduction: isProduction || false,
            priority: priority || 0,
            apiKey: encryptedApiKey ?? null,
            apiSecret: encryptedApiSecret ?? null,
            clientKey: clientKey ?? null,
            merchantId: merchantId ?? null,
            settings: settings ?? null,
            webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook/${provider.toLowerCase()}`,
            callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`,
            updatedAt: new Date()
        },
        update: {
            isEnabled,
            isProduction,
            priority,
            ...(encryptedApiKey && { apiKey: encryptedApiKey }),
            ...(encryptedApiSecret && { apiSecret: encryptedApiSecret }),
            ...(clientKey && { clientKey }),
            ...(merchantId && { merchantId }),
            ...(settings && { settings }),
            updatedAt: new Date()
        }
    })

    // System Log
    logActivitySafe({
        action: 'UPDATE',
        subject: 'Payment Gateway Config',
        userId: ctx.session!.user.id,
        details: { id: config.id, provider: config.provider, isEnabled: config.isEnabled }
    })

    return apiSuccess({
        ...config,
        apiKey: config.apiKey ? '***ENCRYPTED***' : null,
        apiSecret: config.apiSecret ? '***ENCRYPTED***' : null
    }, { message: 'Konfigurasi payment gateway berhasil diperbarui' })
})
