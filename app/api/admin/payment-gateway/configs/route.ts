import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


import { verifyAuth } from '@/lib/auth'
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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
