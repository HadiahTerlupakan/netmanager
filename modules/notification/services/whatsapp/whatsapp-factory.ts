// WhatsApp Provider Factory

import type { WhatsAppProvider, WhatsAppConfig } from './whatsapp-provider-interface'
import { WablasProvider } from './providers/wablas-provider'
import { FonnteProvider } from './providers/fonnte-provider'

export class WhatsAppFactory {
    static createProvider(config: WhatsAppConfig): WhatsAppProvider {
        switch (config.provider) {
            case 'WABLAS':
                return new WablasProvider(config)

            case 'FONNTE':
                return new FonnteProvider(config)

            case 'OFFICIAL':
                // TODO: Implement Official WhatsApp Business API provider
                throw new Error('Official WhatsApp API not yet implemented')

            default:
                throw new Error(`Unknown provider: ${config.provider}`)
        }
    }

    static getSupportedProviders(): Array<{ id: string, name: string }> {
        return [
            { id: 'WABLAS', name: 'Wablas' },
            { id: 'FONNTE', name: 'Fonnte' },
            { id: 'OFFICIAL', name: 'Official WhatsApp Business API (Coming Soon)' }
        ]
    }
}
