import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
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
})
