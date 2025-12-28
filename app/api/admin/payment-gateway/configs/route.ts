import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check
        if (!await hasPermission('payment_gateway:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
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
