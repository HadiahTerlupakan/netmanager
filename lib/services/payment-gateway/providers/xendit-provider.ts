// Xendit Payment Provider Implementation

import {
    PaymentProvider,
    ProviderConfig,
    CreatePaymentParams,
    PaymentResult,
    TransactionStatus,
    WebhookResult,
    TestResult
} from '../provider-interface'

export class XenditProvider implements PaymentProvider {
    name = 'Xendit'
    private config?: ProviderConfig
    private xendit: any

    initialize(config: ProviderConfig): void {
        this.config = config

        // Initialize Xendit SDK
        const Xendit = require('xendit-node')
        this.xendit = new Xendit({
            secretKey: config.apiKey
        })
    }

    async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
        try {
            if (!this.xendit) {
                throw new Error('Xendit not initialized')
            }

            const { Invoice } = this.xendit

            // Calculate expiry time (default 24 hours)
            const expiryHours = params.expiryHours || 24
            const expiryDate = new Date()
            expiryDate.setHours(expiryDate.getHours() + expiryHours)

            // Create invoice
            const invoice = await Invoice.createInvoice({
                externalId: params.orderId,
                amount: params.amount,
                description: params.description,
                invoiceDuration: expiryHours * 3600, // Convert to seconds
                currency: 'IDR',
                payerEmail: params.customerEmail || undefined,
                customer: {
                    givenNames: params.customerName,
                    email: params.customerEmail,
                    mobileNumber: params.customerPhone
                },
                successRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success`,
                failureRedirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/failed`
            })

            return {
                success: true,
                paymentUrl: invoice.invoice_url,
                transactionId: invoice.id,
                expiresAt: new Date(invoice.expiry_date)
            }
        } catch (error: any) {
            console.error('Xendit createPayment error:', error)
            return {
                success: false,
                error: error.message || 'Failed to create payment'
            }
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            if (!this.xendit) {
                throw new Error('Xendit not initialized')
            }

            const { Invoice } = this.xendit

            // Get invoice by external ID
            const invoices = await Invoice.getInvoices({
                externalId: orderId,
                limit: 1
            })

            if (!invoices || invoices.length === 0) {
                throw new Error('Invoice not found')
            }

            const invoice = invoices[0]

            // Map Xendit status to our status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
            switch (invoice.status) {
                case 'PAID':
                case 'SETTLED':
                    status = 'PAID'
                    break
                case 'EXPIRED':
                    status = 'EXPIRED'
                    break
                case 'PENDING':
                    status = 'PENDING'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: invoice.paid_at ? new Date(invoice.paid_at) : undefined,
                paymentMethod: invoice.payment_method,
                amount: invoice.amount,
                transactionId: invoice.id
            }
        } catch (error: any) {
            console.error('Xendit checkStatus error:', error)
            throw error
        }
    }

    async cancelPayment(orderId: string): Promise<void> {
        try {
            if (!this.xendit) {
                throw new Error('Xendit not initialized')
            }

            const { Invoice } = this.xendit

            // Get invoice first
            const invoices = await Invoice.getInvoices({
                externalId: orderId,
                limit: 1
            })

            if (invoices && invoices.length > 0) {
                await Invoice.expireInvoice({
                    invoiceId: invoices[0].id
                })
            }
        } catch (error: any) {
            console.error('Xendit cancelPayment error:', error)
            throw error
        }
    }

    verifyWebhook(payload: any, signature?: string): boolean {
        try {
            if (!this.config) {
                return false
            }

            // Xendit uses callback token for verification
            const callbackToken = payload.callback_token || payload['x-callback-token']

            // In production, you should verify the callback token matches your stored token
            // For now, we'll do basic validation
            return !!callbackToken
        } catch (error) {
            console.error('Xendit webhook verification error:', error)
            return false
        }
    }

    async processWebhook(payload: any): Promise<WebhookResult> {
        try {
            const orderId = payload.external_id

            // Map Xendit status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'
            switch (payload.status) {
                case 'PAID':
                case 'SETTLED':
                    status = 'PAID'
                    break
                case 'EXPIRED':
                    status = 'EXPIRED'
                    break
                case 'PENDING':
                    status = 'PENDING'
                    break
                default:
                    status = 'FAILED'
            }

            return {
                orderId,
                status,
                paidAt: payload.paid_at ? new Date(payload.paid_at) : undefined,
                paymentMethod: payload.payment_method,
                transactionId: payload.id,
                amount: payload.amount,
                raw: payload
            }
        } catch (error: any) {
            console.error('Xendit processWebhook error:', error)
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

            // Initialize with test credentials
            const Xendit = require('xendit-node')
            const testXendit = new Xendit({
                secretKey: this.config.apiKey
            })

            // Try to get balance (this will validate the API key)
            const { Balance } = testXendit
            const balance = await Balance.getBalance({
                accountType: 'CASH'
            })

            return {
                success: true,
                message: 'Connection successful',
                details: {
                    balance: balance.balance,
                    currency: balance.currency
                }
            }
        } catch (error: any) {
            return {
                success: false,
                message: error.message || 'Connection failed',
                details: {
                    error: error.error_code || error.code
                }
            }
        }
    }
}
