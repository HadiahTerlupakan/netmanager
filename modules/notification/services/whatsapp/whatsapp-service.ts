// WhatsApp Service - Main service for sending WhatsApp messages

import { SettingsRepository } from '@/modules/attendance/repositories/SettingsRepository'
import { decryptApiKey } from '@/lib/utils/encryption'
import { WhatsAppFactory } from './whatsapp-factory'
import type { WhatsAppConfig, SendMessageParams, SendFileParams, SendResult } from './whatsapp-provider-interface'

export class WhatsAppService {
    private settingsRepo: SettingsRepository

    constructor(settingsRepo?: SettingsRepository) {
        this.settingsRepo = settingsRepo ?? new SettingsRepository()
    }

    /**
     * Check if WhatsApp is configured
     */
    async isConfigured(): Promise<boolean> {
        try {
            const settings = await this.settingsRepo.findManyByKeys(['WHATSAPP_API_KEY'])

            const apiKey = settings.find(s => s.key === 'WHATSAPP_API_KEY')?.value
            const envKey = process.env.FONNTE_API_KEY

            return !!(apiKey || envKey)
        } catch {
            return false
        }
    }

    /**
     * Load WhatsApp configuration from database
     * Returns null if not configured
     */
    private async loadConfig(): Promise<WhatsAppConfig | null> {
        const settings = await this.settingsRepo.findManyByKeys([
            'WHATSAPP_PROVIDER', 'WHATSAPP_API_KEY', 'WABLAS_DOMAIN', 'WABLAS_DEVICE_ID'
        ])

        const settingsMap: Record<string, string> = {}
        for (const setting of settings) {
            if (setting.key === 'WHATSAPP_API_KEY' && setting.value) {
                try {
                    settingsMap[setting.key] = decryptApiKey(setting.value)
                } catch (error) {
                    console.error('[WhatsApp] Failed to decrypt API key:', error)
                    settingsMap[setting.key] = ''
                }
            } else {
                settingsMap[setting.key] = setting.value || ''
            }
        }

        const provider = (settingsMap['WHATSAPP_PROVIDER'] as 'WABLAS' | 'FONNTE' | 'OFFICIAL') ||
            (process.env.WHATSAPP_PROVIDER as 'WABLAS' | 'FONNTE' | 'OFFICIAL') ||
            'WABLAS'

        const apiKey = settingsMap['WHATSAPP_API_KEY'] || process.env.FONNTE_API_KEY || ''

        if (!apiKey) {
            console.warn('[WhatsApp] API key not configured, skipping message')
            return null
        }

        return {
            provider,
            apiKey,
            domain: settingsMap['WABLAS_DOMAIN'] || process.env.WABLAS_DOMAIN,
            deviceId: settingsMap['WABLAS_DEVICE_ID'] || process.env.WABLAS_DEVICE_ID
        }
    }

    /**
     * Send text message
     */
    async sendMessage(params: SendMessageParams): Promise<SendResult> {
        try {
            const config = await this.loadConfig()

            // Return gracefully if not configured
            if (!config) {
                return {
                    success: false,
                    error: 'WhatsApp belum dikonfigurasi'
                }
            }

            const provider = WhatsAppFactory.createProvider(config)

            // console.log(`[WhatsApp] Sending via ${config.provider} to ${params.phone}`)

            const result = await provider.sendMessage(params)

            if (result.success) {
                // console.log(`[WhatsApp] Message sent successfully, ID: ${result.messageId}`)
            } else {
                console.error(`[WhatsApp] Failed to send:`, result.error)
            }

            return result
        } catch (error: unknown) {
            console.error('[WhatsApp] Error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Terjadi kesalahan'
            }
        }
    }

    /**
     * Send file with optional caption
     */
    async sendFile(params: SendFileParams): Promise<SendResult> {
        try {
            const config = await this.loadConfig()

            // Return gracefully if not configured
            if (!config) {
                return {
                    success: false,
                    error: 'WhatsApp belum dikonfigurasi'
                }
            }

            const provider = WhatsAppFactory.createProvider(config)

            // Check if provider supports file sending
            if (!provider.sendFile) {
                throw new Error(`Provider ${config.provider} tidak mendukung pengiriman file`)
            }

            // console.log(`[WhatsApp] Sending file via ${config.provider} to ${params.phone}`)

            const result = await provider.sendFile(params)

            if (result.success) {
                // console.log(`[WhatsApp] File sent successfully, ID: ${result.messageId}`)
            } else {
                console.error(`[WhatsApp] Failed to send file:`, result.error)
            }

            return result
        } catch (error: unknown) {
            console.error('[WhatsApp] Error:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Terjadi kesalahan'
            }
        }
    }

    /**
     * Test connection with current configuration
     */
    async testConnection(testPhone: string): Promise<SendResult> {
        return this.sendMessage({
            phone: testPhone,
            message: `✅ *Pesan Percobaan dari NetManager*\n\nAPI WhatsApp Anda telah dikonfigurasi dengan benar!\n\nTimestamp: ${new Date().toLocaleString('id-ID')}`
        })
    }
}
