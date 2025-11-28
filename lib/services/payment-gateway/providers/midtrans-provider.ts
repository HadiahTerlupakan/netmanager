// Midtrans Payment Provider Implementation

import {
    PaymentProvider,
    ProviderConfig,
    CreatePaymentParams,
    PaymentResult,
    TransactionStatus,
    WebhookResult,
    TestResult
} from '../provider-interface'

export class MidtransProvider implements PaymentProvider {
    name = 'Midtrans'
    private config?: ProviderConfig
    private snap: any
    private coreApi: any

    initialize(config: ProviderConfig): void {
        this.config = config

        // Initialize Midtrans SDK
        const midtransClient = require('midtrans-client')

        // Snap for payment page
        this.snap = new midtransClient.Snap({
            isProduction: config.isProduction,
            serverKey: config.apiKey,
            clientKey: config.clientKey
        })

        // Core API for status check
        this.coreApi = new midtransClient.CoreApi({
            isProduction: config.isProduction,
            serverKey: config.apiKey,
            clientKey: config.clientKey
        })
    }

    async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
        try {
            if (!this.snap) {
                throw new Error('Midtrans not initialized')
            }

            // Create transaction
            const transaction = await this.snap.createTransaction({
                transaction_details: {
                    order_id: params.orderId,
                    gross_amount: params.amount
                },
                customer_details: {
                    first_name: params.customerName,
                    email: params.customerEmail,
                    phone: params.customerPhone
                },
                item_details: [{
                    id: 'INVOICE',
                    name: params.description,
                    price: params.amount,
                    quantity: 1
                }],
                callbacks: {
                    finish: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
                    error: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`,
                    pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/pending`
                }
            })

            return {
                success: true,
                paymentUrl: transaction.redirect_url,
                transactionId: transaction.token,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }
        } catch (error: any) {
            console.error('Midtrans createPayment error:', error)
            return {
                success: false,
                error: error.message || 'Failed to create payment'
            }
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            if (!this.coreApi) {
                throw new Error('Midtrans not initialized')
            }

            const statusResponse = await this.coreApi.transaction.status(orderId)

            // Map Midtrans status to our status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

            switch (statusResponse.transaction_status) {
                case 'capture':
                case 'settlement':
                    status = 'PAID'
                    break
                case 'pending':
                    status = 'PENDING'
                    break
                case 'deny':
                case 'cancel':
                    status = 'CANCELLED'
                    break
                case 'expire':
                    status = 'EXPIRED'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: status === 'PAID' ? new Date(statusResponse.transaction_time) : undefined,
                paymentMethod: statusResponse.payment_type,
                amount: parseFloat(statusResponse.gross_amount),
                transactionId: statusResponse.transaction_id
            }
        } catch (error: any) {
            console.error('Midtrans checkStatus error:', error)
            throw error
        }
    }

    async cancelPayment(orderId: string): Promise<void> {
        try {
            if (!this.coreApi) {
                throw new Error('Midtrans not initialized')
            }

            await this.coreApi.transaction.cancel(orderId)
        } catch (error: any) {
            console.error('Midtrans cancelPayment error:', error)
            throw error
        }
    }

    verifyWebhook(payload: any, signature?: string): boolean {
        try {
            if (!this.config) {
                return false
            }

            // Midtrans signature verification
            const orderId = payload.order_id
            const statusCode = payload.status_code
            const grossAmount = payload.gross_amount
            const serverKey = this.config.apiKey
            const signatureKey = payload.signature_key

            const crypto = require('crypto')
            const hash = crypto
                .createHash('sha512')
                .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
                .digest('hex')

            return hash === signatureKey
        } catch (error) {
            console.error('Midtrans webhook verification error:', error)
            return false
        }
    }

    async processWebhook(payload: any): Promise<WebhookResult> {
        try {
            const orderId = payload.order_id

            // Map Midtrans status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

            switch (payload.transaction_status) {
                case 'capture':
                case 'settlement':
                    status = 'PAID'
                    break
                case 'pending':
                    status = 'PENDING'
                    break
                case 'deny':
                case 'cancel':
                    status = 'CANCELLED'
                    break
                case 'expire':
                    status = 'EXPIRED'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: status === 'PAID' ? new Date(payload.transaction_time) : undefined,
                paymentMethod: payload.payment_type,
                transactionId: payload.transaction_id,
                amount: parseFloat(payload.gross_amount),
                raw: payload
            }
        } catch (error: any) {
            console.error('Midtrans processWebhook error:', error)
            throw error
        }
    }

    async testConnection(): Promise<TestResult> {
        try {
            if (!this.config) {
                return {
                    success: false,
                    message: 'Provider not initialized'
                }
            }

            // Try to check a dummy transaction status (will fail but validates API key)
            const midtransClient = require('midtrans-client')
            const testCoreApi = new midtransClient.CoreApi({
                isProduction: this.config.isProduction,
                serverKey: this.config.apiKey,
                clientKey: this.config.clientKey
            })

            // Ping the API
            try {
                await testCoreApi.transaction.status('test-order-id')
            } catch (error: any) {
                // If we get 404, it means API key is valid (order not found)
                if (error.httpStatusCode === 404 || error.ApiResponse?.status_code === '404') {
                    return {
                        success: true,
                        message: 'Connection successful (API key valid)',
                        details: {
                            environment: this.config.isProduction ? 'Production' : 'Sandbox'
                        }
                    }
                }

                // 401 means unauthorized (invalid API key)
                if (error.httpStatusCode === 401) {
                    return {
                        success: false,
                        message: 'Invalid API key',
                        details: {
                            error: 'Unauthorized'
                        }
                    }
                }
            }

            return {
                success: true,
                message: 'Connection successful',
                details: {
                    environment: this.config.isProduction ? 'Production' : 'Sandbox'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Connection failed',
                details: {
                    error: error.code || error.error_code
                }
            }
        }
    }
}
