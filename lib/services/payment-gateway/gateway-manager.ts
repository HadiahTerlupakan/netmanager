// Gateway Manager - Manages all payment providers

import { PrismaClient } from '@prisma/client'
import { ProviderFactory } from './provider-factory'
import { PaymentProvider, CreatePaymentParams, PaymentResult } from './provider-interface'
import { decryptApiKey } from '@/lib/utils/encryption'

export class PaymentGatewayManager {
    constructor(private prisma: PrismaClient) { }

    /**
     * Get all enabled providers, sorted by priority
     */
    async getEnabledProviders() {
        return this.prisma.paymentGatewayConfig.findMany({
            where: { isEnabled: true },
            orderBy: { priority: 'desc' }
        })
    }

    /**
     * Get best provider for payment (based on priority)
     */
    async getBestProvider() {
        const providers = await this.getEnabledProviders()

        if (providers.length === 0) {
            throw new Error('No payment gateway enabled. Please configure at least one payment provider in admin settings.')
        }

        // Return highest priority enabled provider
        return providers[0]
    }

    /**
     * Get provider instance with decrypted config
     */
    async getProviderInstance(providerType: string): Promise<PaymentProvider> {
        // Get config from database
        const config = await this.prisma.paymentGatewayConfig.findUnique({
            where: { provider: providerType }
        })

        if (!config) {
            throw new Error(`Provider ${providerType} not configured`)
        }

        if (!config.isEnabled) {
            throw new Error(`Provider ${providerType} is disabled`)
        }

        // Create provider instance
        const provider = ProviderFactory.createProvider(providerType)

        // Decrypt API keys and initialize
        provider.initialize({
            apiKey: config.apiKey ? decryptApiKey(config.apiKey) : '',
            apiSecret: config.apiSecret ? decryptApiKey(config.apiSecret) : undefined,
            clientKey: config.clientKey || undefined,
            merchantId: config.merchantId || undefined,
            isProduction: config.isProduction,
            settings: config.settings as Record<string, any> || {}
        })

        return provider
    }

    /**
     * Create payment with automatic provider selection
     */
    async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
        // Get best provider
        const providerConfig = await this.getBestProvider()

        try {
            // Get provider instance
            const provider = await this.getProviderInstance(providerConfig.provider)

            // Create payment
            const result = await provider.createPayment(params)

            return result
        } catch (error: any) {
            console.error(`Payment creation failed with ${providerConfig.provider}:`, error)

            // Try fallback to next provider
            const allProviders = await this.getEnabledProviders()
            if (allProviders.length > 1) {
                const fallbackProvider = allProviders[1]
                console.log(`Trying fallback provider: ${fallbackProvider.provider}`)

                try {
                    const provider = await this.getProviderInstance(fallbackProvider.provider)
                    return await provider.createPayment(params)
                } catch (fallbackError: any) {
                    console.error(`Fallback provider also failed:`, fallbackError)
                    throw new Error(`All payment providers failed. Last error: ${fallbackError.message}`)
                }
            }

            throw error
        }
    }

    /**
     * Create payment with specific provider
     */
    async createPaymentWithProvider(
        providerType: string,
        params: CreatePaymentParams
    ): Promise<PaymentResult> {
        const provider = await this.getProviderInstance(providerType)
        return provider.createPayment(params)
    }

    /**
     * Check payment status
     */
    async checkPaymentStatus(providerType: string, orderId: string) {
        const provider = await this.getProviderInstance(providerType)
        return provider.checkStatus(orderId)
    }

    /**
     * Process webhook from any provider
     */
    async processWebhook(providerType: string, payload: any, signature?: string) {
        const config = await this.prisma.paymentGatewayConfig.findUnique({
            where: { provider: providerType }
        })

        if (!config || !config.isEnabled) {
            throw new Error('Provider not enabled')
        }

        const provider = await this.getProviderInstance(providerType)

        // Verify webhook signature
        const isValid = provider.verifyWebhook(payload, signature)
        if (!isValid) {
            throw new Error('Invalid webhook signature')
        }

        // Process webhook
        return provider.processWebhook(payload)
    }

    /**
     * Test provider connection
     */
    async testProviderConnection(providerType: string, tempConfig?: {
        apiKey: string
        apiSecret?: string
        clientKey?: string
        isProduction: boolean
    }) {
        const provider = ProviderFactory.createProvider(providerType)

        // If temp config provided, use it (for testing before saving)
        if (tempConfig) {
            provider.initialize(tempConfig)
            return provider.testConnection()
        }

        // Otherwise use saved config
        const savedProvider = await this.getProviderInstance(providerType)
        return savedProvider.testConnection()
    }
}
