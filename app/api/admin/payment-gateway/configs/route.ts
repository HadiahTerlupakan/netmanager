import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('payment_gateway:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat payment gateway');
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

        return apiSuccess(sanitizedConfigs)
    } catch (error: unknown) {
        console.error('Error fetching gateway configs:', error)
        return ApiErrors.internalError('Gagal mengambil konfigurasi payment gateway')
    }
}
