import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey } from '@/lib/utils/encryption'


import { verifyAuth } from '@/lib/auth'
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        return NextResponse.json({
            ...config,
            apiKey: config.apiKey ? '***ENCRYPTED***' : null,
            apiSecret: config.apiSecret ? '***ENCRYPTED***' : null
        })
    } catch (error: any) {
        console.error('Error updating gateway config:', error)
        return NextResponse.json(
            { error: 'Failed to update configuration', details: error.message },
            { status: 500 }
        )
    }
}
