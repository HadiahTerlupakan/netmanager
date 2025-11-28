import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

const prisma = new PrismaClient()
const gatewayManager = new PaymentGatewayManager(prisma)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { provider, apiKey, apiSecret, clientKey, isProduction } = body

        if (!provider || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields: provider, apiKey' },
                { status: 400 }
            )
        }

        // Test connection with temporary config
        const result = await gatewayManager.testProviderConnection(provider, {
            apiKey,
            apiSecret,
            clientKey,
            isProduction: isProduction || false
        })

        // Update test status in database (if config exists)
        try {
            await prisma.paymentGatewayConfig.update({
                where: { provider },
                data: {
                    lastTestedAt: new Date(),
                    testStatus: result.success ? 'SUCCESS' : 'FAILED'
                }
            })
        } catch (e) {
            // Config might not exist yet, ignore
        }

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Error testing connection:', error)
        return NextResponse.json(
            { error: 'Failed to test connection', details: error.message },
            { status: 500 }
        )
    }
}
