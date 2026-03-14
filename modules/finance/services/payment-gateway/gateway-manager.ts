import { prismaBilling } from '@/lib/prisma-billing';
// Gateway Manager - Manages all payment providers

import { ProviderFactory } from './provider-factory'
import type { PaymentProvider, CreatePaymentParams, PaymentResult } from './provider-interface'

import { prisma as defaultPrisma } from '@/lib/prisma';
import { decryptApiKey } from '@/lib/utils/encryption'

type PrismaInstance = typeof defaultPrisma;

export class PaymentGatewayManager {
    private prisma: PrismaInstance;

    constructor(prisma: PrismaInstance = defaultPrisma) {
        this.prisma = prisma;
    }

    /**
     * Get all enabled providers, sorted by priority
     */
    async getEnabledProviders() {
        return prismaBilling.paymentGatewayConfig.findMany({
            where: { isEnabled: true },
            orderBy: { priority: 'desc' }
        })
    }

    /**
     * Get best provider for payment (based on priority)
     */
    async getBestProvider() {
        const providers = await this.getEnabledProviders()
        const firstProvider = providers[0]

        if (!firstProvider) {
            throw new Error('No payment gateway enabled. Please configure at least one payment provider in admin settings.')
        }

        // Return highest priority enabled provider
        return firstProvider
    }

    /**
     * Get provider instance with decrypted config
     */
    async getProviderInstance(providerType: string): Promise<PaymentProvider> {
        // Get config from database
        const config = await prismaBilling.paymentGatewayConfig.findUnique({
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
        const apiSecret = config.apiSecret ? decryptApiKey(config.apiSecret) : undefined

        await provider.initialize({
            apiKey: config.apiKey ? decryptApiKey(config.apiKey) : '',
            ...(apiSecret ? { apiSecret } : {}),
            ...(config.clientKey ? { clientKey: config.clientKey } : {}),
            ...(config.merchantId ? { merchantId: config.merchantId } : {}),
            isProduction: config.isProduction,
            settings: (config.settings as Record<string, unknown>) || {}
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
        } catch (error: unknown) {
            console.error(`Payment creation failed with ${providerConfig.provider}:`, error)

            // Try fallback to remaining providers in priority order
            const allProviders = await this.getEnabledProviders()
            const fallbackProviders = allProviders.filter(p => p.provider !== providerConfig.provider)

            for (const fallback of fallbackProviders) {
                // console.log(`Trying fallback provider: ${fallback.provider}`)

                try {
                    const provider = await this.getProviderInstance(fallback.provider)
                    return await provider.createPayment(params)
                } catch (fallbackError: unknown) {
                    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                    console.error(`Fallback provider ${fallback.provider} failed: ${fallbackMessage}`)
                    continue
                }
            }

            throw new Error(`All payment providers failed. Primary: ${providerConfig.provider}`)
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
    async processWebhook(providerType: string, payload: Record<string, unknown>, signature?: string, rawBody?: string) {
        const config = await prismaBilling.paymentGatewayConfig.findUnique({
            where: { provider: providerType }
        })

        if (!config || !config.isEnabled) {
            throw new Error('Provider not enabled')
        }

        const provider = await this.getProviderInstance(providerType)

        // Verify webhook signature
        const isValid = provider.verifyWebhook(payload, signature, rawBody)
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
            await provider.initialize(tempConfig)
            return provider.testConnection()
        }

        // Otherwise use saved config
        const savedProvider = await this.getProviderInstance(providerType)
        return savedProvider.testConnection()
    }
}
