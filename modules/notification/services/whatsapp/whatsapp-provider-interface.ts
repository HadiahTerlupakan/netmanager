// WhatsApp Provider Interface - Abstraction for all WhatsApp providers

export interface WhatsAppProvider {
    name: string

    // Send text message
    sendMessage(params: SendMessageParams): Promise<SendResult>

    // Send message with file attachment
    sendFile?(params: SendFileParams): Promise<SendResult>
}

export interface SendMessageParams {
    phone: string // Format: 628123456789
    message: string
}

export interface SendFileParams {
    phone: string
    fileUrl: string
    caption?: string
    filename?: string
}

export interface SendResult {
    success: boolean
    messageId?: string
    error?: string
}

export interface WhatsAppConfig {
    provider: 'WABLAS' | 'FONNTE' | 'OFFICIAL'
    apiKey: string
    domain?: string // For Wablas
    deviceId?: string // For Wablas
    phoneNumberId?: string // For Official WhatsApp API
}
