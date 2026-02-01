// Wablas WhatsApp Provider Implementation

import type {
    WhatsAppProvider,
    SendMessageParams,
    SendFileParams,
    SendResult,
    WhatsAppConfig
} from '../whatsapp-provider-interface'
import { whatsAppThrottler } from '../whatsapp-throttler'

export class WablasProvider implements WhatsAppProvider {
    name = 'Wablas'
    private config: WhatsAppConfig

    constructor(config: WhatsAppConfig) {
        this.config = config
    }

    async sendMessage(params: SendMessageParams): Promise<SendResult> {
        try {
            if (!this.config.domain) {
                throw new Error('Wablas domain not configured')
            }

            const url = `https://${this.config.domain}/api/send-message`

            // Use throttler to prevent spamming
            const response = await whatsAppThrottler.add(async () => {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': this.config.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: params.phone,
                        message: params.message
                    })
                })
            })

            const result = await response.json()

            if (response.ok && result.status) {
                return {
                    success: true,
                    messageId: result.data?.messages?.[0]?.id || result.data?.id || result.id
                }
            } else {
                return {
                    success: false,
                    error: result.message || 'Failed to send message'
                }
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }

    async sendFile(params: SendFileParams): Promise<SendResult> {
        try {
            if (!this.config.domain) {
                throw new Error('Wablas domain not configured')
            }

            const url = `https://${this.config.domain}/api/send-document`

            // Use throttler to prevent spamming
            const response = await whatsAppThrottler.add(async () => {
                return fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': this.config.apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone: params.phone,
                        document: params.fileUrl,
                        caption: params.caption || '',
                        filename: params.filename || 'document.pdf'
                    })
                })
            })

            const result = await response.json()

            if (response.ok && result.status) {
                return {
                    success: true,
                    messageId: result.data?.messages?.[0]?.id || result.data?.id || result.id
                }
            } else {
                return {
                    success: false,
                    error: result.message || 'Failed to send file'
                }
            }
        } catch (error: unknown) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error'
            }
        }
    }
}
