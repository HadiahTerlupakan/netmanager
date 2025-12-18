// Duitku Payment Provider Implementation

import crypto from 'crypto'
import type {
    PaymentProvider,
    ProviderConfig,
    CreatePaymentParams,
    PaymentResult,
    TransactionStatus,
    WebhookResult,
    TestResult
} from '../provider-interface'

export class DuitkuProvider implements PaymentProvider {
    name = 'Duitku'
    private config?: ProviderConfig
    private baseUrl: string = ''

    initialize(config: ProviderConfig): void {
        this.config = config

        // Set base URL based on environment
        this.baseUrl = config.isProduction
            ? 'https://passport.duitku.com/webapi/api'
            : 'https://sandbox.duitku.com/webapi/api'
    }

    async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
        try {
            if (!this.config) {
                throw new Error('Duitku not initialized')
            }

            const merchantCode = this.config.merchantId || ''
            const apiKey = this.config.apiKey
            const merchantOrderId = params.orderId
            const paymentAmount = params.amount

            // Calculate expiry time (default 24 hours)
            const expiryHours = params.expiryHours || 24
            const expiryMinutes = expiryHours * 60

            // Create signature for request
            const signature = crypto
                .createHash('md5')
                .update(`${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`)
                .digest('hex')

            const requestBody = {
                merchantCode,
                paymentAmount,
                paymentMethod: 'VC', // Virtual Account - can be changed based on preference
                merchantOrderId,
                productDetails: params.description,
                merchantUserInfo: params.customerName,
                customerVaName: params.customerName,
                email: params.customerEmail,
                phoneNumber: params.customerPhone,
                callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook/duitku`,
                returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
                signature,
                expiryPeriod: expiryMinutes
            }

            const response = await fetch(`${this.baseUrl}/merchant/createinvoice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            })

            const result = await response.json()

            if (result.statusCode === '00') {
                return {
                    success: true,
                    paymentUrl: result.paymentUrl,
                    vaNumber: result.vaNumber,
                    transactionId: result.reference,
                    expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
                }
            } else {
                return {
                    success: false,
                    error: result.statusMessage || 'Failed to create payment'
                }
            }
        } catch (error: any) {
            console.error('Duitku createPayment error:', error)
            return {
                success: false,
                error: error.message || 'Failed to create payment'
            }
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            if (!this.config) {
                throw new Error('Duitku not initialized')
            }

            const merchantCode = this.config.merchantId || ''
            const apiKey = this.config.apiKey

            // Create signature for status check
            const signature = crypto
                .createHash('md5')
                .update(`${merchantCode}${orderId}${apiKey}`)
                .digest('hex')

            const response = await fetch(
                `${this.baseUrl}/merchant/transactionStatus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    merchantCode,
                    merchantOrderId: orderId,
                    signature
                })
            })

            const result = await response.json()

            // Map Duitku status codes to our status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
            switch (result.statusCode) {
                case '00': // Success
                    status = 'PAID'
                    break
                case '01': // Pending
                    status = 'PENDING'
                    break
                case '02': // Expired
                    status = 'EXPIRED'
                    break
                case '03': // Failed/Cancelled
                    status = 'CANCELLED'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: result.statusCode === '00' ? new Date() : undefined,
                paymentMethod: result.paymentMethod,
                amount: result.amount,
                transactionId: result.reference
            }
        } catch (error: any) {
            console.error('Duitku checkStatus error:', error)
            throw error
        }
    }

    async cancelPayment(orderId: string): Promise<void> {
        // Duitku doesn't have explicit cancel endpoint
        // Transactions automatically expire after expiry period
        console.log(`Duitku: Payment ${orderId} will auto-expire`)
    }

    verifyWebhook(payload: any, signature?: string): boolean {
        try {
            if (!this.config) {
                return false
            }

            const merchantCode = this.config.merchantId || ''
            const apiKey = this.config.apiKey
            const amount = payload.amount
            const merchantOrderId = payload.merchantOrderId

            // Calculate expected signature
            const expectedSignature = crypto
                .createHash('md5')
                .update(`${merchantCode}${amount}${merchantOrderId}${apiKey}`)
                .digest('hex')

            return payload.signature === expectedSignature
        } catch (error) {
            console.error('Duitku webhook verification error:', error)
            return false
        }
    }

    async processWebhook(payload: any): Promise<WebhookResult> {
        try {
            const orderId = payload.merchantOrderId

            // Map Duitku result codes
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
            switch (payload.resultCode) {
                case '00': // Success
                    status = 'PAID'
                    break
                case '01': // Pending
                    status = 'PENDING'
                    break
                case '02': // Expired
                    status = 'EXPIRED'
                    break
                case '03': // Failed/Cancelled
                    status = 'CANCELLED'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: status === 'PAID' ? new Date() : undefined,
                paymentMethod: payload.paymentCode,
                transactionId: payload.reference,
                amount: parseFloat(payload.amount),
                raw: payload
            }
        } catch (error: any) {
            console.error('Duitku processWebhook error:', error)
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

            const merchantCode = this.config.merchantId || ''
            const apiKey = this.config.apiKey

            // Test with status inquiry for a dummy transaction
            const testOrderId = 'TEST-' + Date.now()
            const signature = crypto
                .createHash('md5')
                .update(`${merchantCode}${testOrderId}${apiKey}`)
                .digest('hex')

            const response = await fetch(
                `${this.baseUrl}/merchant/transactionStatus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    merchantCode,
                    merchantOrderId: testOrderId,
                    signature
                })
            })

            const result = await response.json()

            // If we get a response (even if transaction not found), credentials are valid
            if (result.statusCode || result.statusMessage) {
                return {
                    success: true,
                    message: 'Connection successful',
                    details: {
                        merchantCode,
                        environment: this.config.isProduction ? 'Production' : 'Sandbox'
                    }
                }
            } else {
                return {
                    success: false,
                    message: 'Invalid response from Duitku API'
                }
            }
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Connection failed',
                details: {
                    error: error.code
                }
            }
        }
    }
}
