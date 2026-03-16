// Payment Provider Interface - Abstraction for all payment gateways

export interface PaymentProvider {
    name: string

    // Initialize with configuration
    initialize(config: ProviderConfig): void

    // Create payment request
    createPayment(params: CreatePaymentParams): Promise<PaymentResult>

    // Check transaction status
    checkStatus(orderId: string): Promise<TransactionStatus>

    // Cancel payment
    cancelPayment(orderId: string): Promise<void>

    // Verify webhook signature
    verifyWebhook(payload: unknown, signature?: string, rawBody?: string): boolean

    // Process webhook notification
    processWebhook(payload: unknown): Promise<WebhookResult>

    // Test API connection (for settings page)
    testConnection(): Promise<TestResult>
}

// Provider Configuration
export interface ProviderConfig {
    apiKey: string
    apiSecret?: string
    clientKey?: string
    merchantId?: string
    isProduction: boolean
    settings?: Record<string, unknown>
}

// Create Payment Parameters
export interface CreatePaymentParams {
    orderId: string
    amount: number
    customerName: string
    customerEmail: string
    customerPhone: string
    description: string
    expiryHours?: number
    paymentMethods?: string[] // ["bank_transfer", "ewallet", "credit_card"]
    tenantId?: string
}

// Payment Creation Result
export interface PaymentResult {
    success: boolean
    paymentUrl?: string
    qrCodeUrl?: string
    vaNumber?: string
    bankCode?: string
    expiresAt?: Date
    transactionId?: string
    error?: string
}

// Transaction Status
export interface TransactionStatus {
    orderId: string
    status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
    paidAt?: Date
    paymentMethod?: string
    amount?: number
    transactionId?: string
}

// Webhook Processing Result
export interface WebhookResult {
    orderId: string
    status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
    paidAt?: Date
    paymentMethod?: string
    transactionId?: string
    amount?: number
    raw?: unknown
}

// Connection Test Result
export interface TestResult {
    success: boolean
    message: string
    details?: Record<string, unknown>
}
