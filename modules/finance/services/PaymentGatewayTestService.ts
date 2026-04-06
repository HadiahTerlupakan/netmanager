import { PaymentGatewayManager } from './payment-gateway/gateway-manager'
import type { TestResult } from './payment-gateway/provider-interface'

export type PaymentGatewayTestConnectionParams = {
    provider: string
    apiKey?: string
    clientKey?: string
    isProduction?: boolean
}

export class PaymentGatewayTestService {
    constructor(private readonly manager = new PaymentGatewayManager()) {}

    async testConnection(params: PaymentGatewayTestConnectionParams): Promise<TestResult> {
        const tempConfig = {
            apiKey: (params.apiKey ?? '').trim(),
            clientKey: (params.clientKey ?? '').trim(),
            isProduction: Boolean(params.isProduction),
        }

        return this.manager.testProviderConnection(params.provider, tempConfig)
    }
}

let paymentGatewayTestService: PaymentGatewayTestService | null = null

export function getPaymentGatewayTestService(): PaymentGatewayTestService {
    if (!paymentGatewayTestService) {
        paymentGatewayTestService = new PaymentGatewayTestService()
    }

    return paymentGatewayTestService
}
