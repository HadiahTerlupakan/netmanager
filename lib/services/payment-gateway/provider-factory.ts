// Provider Factory - Creates payment provider instances

import type { PaymentProvider } from './provider-interface'
import { XenditProvider } from './providers/xendit-provider'
import { MidtransProvider } from './providers/midtrans-provider'
import { DuitkuProvider } from './providers/duitku-provider'
import { BRIProvider } from './providers/bri-provider'
import { BCAProvider } from './providers/bca-provider'

export class ProviderFactory {
    /**
     * Create a payment provider instance
     */
    static createProvider(type: string): PaymentProvider {
        switch (type.toUpperCase()) {
            case 'XENDIT':
                return new XenditProvider()

            case 'MIDTRANS':
                return new MidtransProvider()

            case 'DUITKU':
                return new DuitkuProvider()

            case 'BRI':
            case 'BRI_API':
                return new BRIProvider()

            case 'BCA':
            case 'BCA_API':
                return new BCAProvider()

            default:
                throw new Error(`Unknown payment provider: ${type}`)
        }
    }

    /**
     * Get list of supported providers
     */
    static getSupportedProviders(): string[] {
        return ['XENDIT', 'MIDTRANS', 'DUITKU', 'BRI', 'BCA']
    }

    /**
     * Check if provider is supported
     */
    static isSupported(providerType: string): boolean {
        return this.getSupportedProviders().includes(providerType.toUpperCase())
    }
}
