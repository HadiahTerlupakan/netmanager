import { prismaBilling } from '@/lib/prisma-billing'
import type { PaymentGatewayConfig, Prisma } from '@prisma/client-billing'

export class PaymentGatewayConfigRepository {
    async findEnabled() {
        return prismaBilling.paymentGatewayConfig.findMany({
            where: { isEnabled: true },
            orderBy: { priority: 'desc' }
        })
    }

    async findByProvider(providerType: string, tenantId?: string) {
        return prismaBilling.paymentGatewayConfig.findFirst({
            where: {
                provider: providerType,
                ...(tenantId ? { tenantId } : {})
            }
        })
    }

    async findFirst(where: Prisma.PaymentGatewayConfigWhereInput) {
        return prismaBilling.paymentGatewayConfig.findFirst({ where })
    }

    async findMany(where: Prisma.PaymentGatewayConfigWhereInput) {
        return prismaBilling.paymentGatewayConfig.findMany({ where })
    }
}
