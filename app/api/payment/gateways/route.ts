// API to get enabled payment gateways for customer use
import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
    try {
        // Get all enabled payment gateways
        const enabledGateways = await prisma.paymentGatewayConfig.findMany({
            where: {
                isEnabled: true
            },
            select: {
                provider: true,
                priority: true,
                isProduction: true
            },
            orderBy: {
                priority: 'desc' // Higher priority first
            }
        })

        // Map to customer-friendly format
        const gateways = enabledGateways.map(gateway => ({
            id: gateway.provider.toLowerCase(),
            name: getGatewayDisplayName(gateway.provider),
            provider: gateway.provider,
            priority: gateway.priority,
            isProduction: gateway.isProduction
        }))

        return NextResponse.json(gateways)
    } catch (error) {
        console.error('Error fetching enabled gateways:', error)
        return NextResponse.json(
            { error: 'Failed to fetch payment gateways' },
            { status: 500 }
        )
    }
}

function getGatewayDisplayName(provider: string): string {
    const names: Record<string, string> = {
        'XENDIT': 'Xendit',
        'MIDTRANS': 'Midtrans',
        'DUITKU': 'Duitku',
        'BRI': 'BRI',
        'BCA': 'BCA'
    }
    return names[provider] || provider
}
