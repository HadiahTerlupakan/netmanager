import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
    try {
        // TODO: Add proper admin authentication
        const configs = await prisma.paymentGatewayConfig.findMany({
            orderBy: { priority: 'desc' }
        })

        // Don't send encrypted API keys to frontend
        const sanitizedConfigs = configs.map(config => ({
            ...config,
            apiKey: config.apiKey ? '***ENCRYPTED***' : null,
            apiSecret: config.apiSecret ? '***ENCRYPTED***' : null
        }))

        return NextResponse.json(sanitizedConfigs)
    } catch (error: any) {
        console.error('Error fetching gateway configs:', error)
        return NextResponse.json(
            { error: 'Failed to fetch configurations', details: error.message },
            { status: 500 }
        )
    }
}
