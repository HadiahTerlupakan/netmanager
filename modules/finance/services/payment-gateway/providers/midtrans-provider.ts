// Midtrans Payment Provider Implementation

import type {
    PaymentProvider,
    ProviderConfig,
    CreatePaymentParams,
    PaymentResult,
    TransactionStatus,
    WebhookResult,
    TestResult
} from '../provider-interface'
import midtransClient from 'midtrans-client'
import * as crypto from 'crypto'

export class MidtransProvider implements PaymentProvider {
    name = 'Midtrans'
    private config?: ProviderConfig
    private snap: unknown = null
    private coreApi: unknown = null

    initialize(config: ProviderConfig): void {
        this.config = config

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
            const transaction = await (this.snap as { createTransaction: (p: unknown) => Promise<{ redirect_url: string, token: string }> }).createTransaction({
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

            const expiryHours = params.expiryHours || 24
            return {
                success: true,
                paymentUrl: transaction.redirect_url,
                transactionId: transaction.token,
                expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
            }
        } catch (error: unknown) {
            console.error('Midtrans createPayment error:', error)
            const message = error instanceof Error ? error.message : 'Failed to create payment'
            return {
                success: false,
                error: message
            }
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            if (!this.coreApi) {
                throw new Error('Midtrans not initialized')
            }

            interface MidtransStatusResponse {
                transaction_status: string;
                transaction_time: string;
                payment_type: string;
                gross_amount: string;
                transaction_id: string;
            }

            const statusResponse = await (this.coreApi as { transaction: { status: (id: string) => Promise<MidtransStatusResponse> } }).transaction.status(orderId)

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
                ...(status === 'PAID' ? { paidAt: new Date(statusResponse.transaction_time) } : {}),
                paymentMethod: statusResponse.payment_type,
                amount: parseFloat(statusResponse.gross_amount),
                transactionId: statusResponse.transaction_id
            }
        } catch (error: unknown) {
            console.error('Midtrans checkStatus error:', error)
            throw error
        }
    }

    async cancelPayment(orderId: string): Promise<void> {
        try {
            if (!this.coreApi) {
                throw new Error('Midtrans not initialized')
            }

            await (this.coreApi as { transaction: { cancel: (id: string) => Promise<void> } }).transaction.cancel(orderId)
        } catch (error: unknown) {
            console.error('Midtrans cancelPayment error:', error)
            throw error
        }
    }

    verifyWebhook(payload: Record<string, unknown>, _signature?: string): boolean {
        try {
            if (!this.config) {
                return false
            }

            // Midtrans signature verification
            const orderId = payload.order_id as string
            const statusCode = payload.status_code as string
            const grossAmount = payload.gross_amount as string
            const serverKey = this.config.apiKey
            const signatureKey = payload.signature_key as string

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

    async processWebhook(payload: Record<string, unknown>): Promise<WebhookResult> {
        try {
            const orderId = payload.order_id as string

            // Map Midtrans status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

            switch (payload.transaction_status as string) {
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
                ...(status === 'PAID' ? { paidAt: new Date(payload.transaction_time as string) } : {}),
                paymentMethod: payload.payment_type as string,
                transactionId: payload.transaction_id as string,
                amount: parseFloat(payload.gross_amount as string),
                raw: payload
            }
        } catch (error: unknown) {
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
            const testCoreApi = new midtransClient.CoreApi({
                isProduction: this.config.isProduction,
                serverKey: this.config.apiKey,
                clientKey: this.config.clientKey
            }) as unknown as { transaction: { status: (id: string) => Promise<unknown> } }

            // Ping the API
            try {
                await testCoreApi.transaction.status('test-order-id')
            } catch (error: unknown) {
                const err = error as Record<string, unknown>
                // If we get 404, it means API key is valid (order not found)
                if (err.httpStatusCode === 404 || (err.ApiResponse as Record<string, unknown>)?.status_code === '404') {
                    return {
                        success: true,
                        message: 'Connection successful (API key valid)',
                        details: {
                            environment: this.config.isProduction ? 'Production' : 'Sandbox'
                        }
                    }
                }

                // 401 means unauthorized (invalid API key)
                if (err.httpStatusCode === 401) {
                    return {
                        success: false,
                        message: 'API key tidak valid',
                        details: {
                            error: 'Tidak terautentikasi'
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
        } catch (error: unknown) {
            const err = error as Record<string, unknown>
            return {
                success: false,
                message: (error as Error).message || 'Koneksi gagal',
                details: {
                    error: (err.code as string) || (err.error_code as string)
                }
            }
        }
    }
}
