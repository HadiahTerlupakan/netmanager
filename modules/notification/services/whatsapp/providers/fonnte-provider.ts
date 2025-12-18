// Fonnte WhatsApp Provider Implementation

import type {
    WhatsAppProvider,
    SendMessageParams,
    SendFileParams,
    SendResult,
    WhatsAppConfig
} from '../whatsapp-provider-interface'

export class FonnteProvider implements WhatsAppProvider {
    name = 'Fonnte'
    private config: WhatsAppConfig

    constructor(config: WhatsAppConfig) {
        this.config = config
    }

    async sendMessage(params: SendMessageParams): Promise<SendResult> {
        try {
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': this.config.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target: params.phone,
                    message: params.message,
                    countryCode: '62'
                })
            })

            const result = await response.json()

            if (response.ok && (result.status === 'send' || result.status === 'success' || result.status)) {
                return {
                    success: true,
                    messageId: result.id || result.message_id
                }
            } else {
                return {
                    success: false,
                    error: result.reason || result.message || 'Failed to send message'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Network error'
            }
        }
    }

    async sendFile(params: SendFileParams): Promise<SendResult> {
        try {
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': this.config.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    target: params.phone,
                    file: params.fileUrl,
                    caption: params.caption || '',
                    filename: params.filename || 'document.pdf',
                    countryCode: '62'
                })
            })

            const result = await response.json()

            if (response.ok && (result.status === 'send' || result.status === 'success' || result.status)) {
                return {
                    success: true,
                    messageId: result.id || result.message_id
                }
            } else {
                return {
                    success: false,
                    error: result.reason || result.message || 'Failed to send file'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Network error'
            }
        }
    }
}
