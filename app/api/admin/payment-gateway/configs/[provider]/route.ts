import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey } from '@/lib/utils/encryption'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('payment_gateway:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah payment gateway');
        }

        const { provider } = await params;
        const body = await request.json()

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
        const config = await prisma.paymentGatewayConfig.upsert({
            where: { provider },
            create: {
                id: randomUUID(),
                provider,
                providerName: provider.charAt(0) + provider.slice(1).toLowerCase(),
                isEnabled: isEnabled || false,
                isProduction: isProduction || false,
                priority: priority || 0,
                apiKey: encryptedApiKey,
                apiSecret: encryptedApiSecret,
                clientKey,
                merchantId,
                settings,
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
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Payment Gateway Config',
                userId: user.id,
                details: { id: config.id, provider: config.provider, isEnabled: config.isEnabled }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess({
            ...config,
            apiKey: config.apiKey ? '***ENCRYPTED***' : null,
            apiSecret: config.apiSecret ? '***ENCRYPTED***' : null
        }, { message: 'Konfigurasi payment gateway berhasil diperbarui' })
    } catch (error: any) {
        console.error('Error updating gateway config:', error)
        return ApiErrors.internalError('Gagal memperbarui konfigurasi payment gateway')
    }
}
