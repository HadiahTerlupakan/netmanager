// BRI API Payment Provider Implementation
// Documentation: https://developers.bri.co.id/

import type {
    PaymentProvider,
    ProviderConfig,
    CreatePaymentParams,
    PaymentResult,
    TransactionStatus,
    WebhookResult,
    TestResult
} from '../provider-interface'
import crypto from 'crypto'

export class BRIProvider implements PaymentProvider {
    name = 'BRI API'
    private config?: ProviderConfig
    private baseUrl?: string

    initialize(config: ProviderConfig): void {
        this.config = config
        // BRI API menggunakan base URL berbeda untuk sandbox dan production
        this.baseUrl = config.isProduction
            ? 'https://api.bri.co.id' // Production URL
            : 'https://sandbox.partner.api.bri.co.id' // Sandbox URL
    }

    /**
     * Generate BRI API OAuth2 access token
     * BRI menggunakan OAuth2 untuk authentication
     */
    private async getAccessToken(): Promise<string> {
        if (!this.config) {
            throw new Error('BRI provider not initialized')
        }

        try {
            const response = await fetch(`${this.baseUrl}/oauth/client_credential/accesstoken?grant_type=client_credentials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.config.clientKey}:${this.config.apiSecret}`).toString('base64')}`
                }
            })

            if (!response.ok) {
                throw new Error('Failed to get access token')
            }

            const data = await response.json()
            return data.access_token
        } catch (error: any) {
            console.error('BRI getAccessToken error:', error)
            throw error
        }
    }

    /**
     * Generate BRI API signature
     * BRI requires specific signature format for security
     */
    private generateSignature(method: string, url: string, accessToken: string, body: string, timestamp: string): string {
        if (!this.config) {
            throw new Error('BRI provider not initialized')
        }

        // Format: HTTPMethod + ":" + RelativeUrl + ":" + Lowercase(HexEncode(SHA-256(RequestBody))) + ":" + AccessToken + ":" + Timestamp
        const hashedBody = crypto.createHash('sha256').update(body).digest('hex').toLowerCase()
        const stringToSign = `${method}:${url}:${hashedBody}:${accessToken}:${timestamp}`

        // Create HMAC SHA256 signature
        const signature = crypto
            .createHmac('sha256', this.config.apiSecret || '')
            .update(stringToSign)
            .digest('base64')

        return signature
    }

    async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
        try {
            if (!this.config || !this.baseUrl) {
                throw new Error('BRI provider not initialized')
            }

            // Get access token
            const accessToken = await this.getAccessToken()

            // Calculate expiry
            const expiryHours = params.expiryHours || 24
            const expiryDate = new Date()
            expiryDate.setHours(expiryDate.getHours() + expiryHours)

            // Prepare request body - CUSTOMIZE based on BRI API documentation
            const requestBody = {
                institutionCode: this.config.merchantId, // Your BRI merchant/institution code
                brivaNo: params.orderId, // Virtual Account number or transaction ID
                custCode: params.orderId.substring(0, 16), // Customer code (max 16 chars)
                nama: params.customerName,
                amount: params.amount.toString(),
                keterangan: params.description,
                expiredDate: expiryDate.toISOString().split('T')[0] // Format: YYYY-MM-DD
            }

            const bodyString = JSON.stringify(requestBody)
            const timestamp = new Date().toISOString()
            const url = '/v1/briva' // Adjust based on actual BRI endpoint

            // Generate signature
            const signature = this.generateSignature('POST', url, accessToken, bodyString, timestamp)

            // Make API request
            const response = await fetch(`${this.baseUrl}${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'BRI-Timestamp': timestamp,
                    'BRI-Signature': signature
                },
                body: bodyString
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to create payment')
            }

            const data = await response.json()

            // TODO: Customize return based on actual BRI API response structure
            return {
                success: true,
                transactionId: data.trxId || params.orderId,
                vaNumber: data.vaNumber || data.brivaNo,
                paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL}/payment/bri/${data.brivaNo}`, // Custom payment instruction page
                expiresAt: expiryDate
            }
        } catch (error: any) {
            console.error('BRI createPayment error:', error)
            return {
                success: false,
                error: error.message || 'Failed to create payment'
            }
        }
    }

    async checkStatus(orderId: string): Promise<TransactionStatus> {
        try {
            if (!this.config || !this.baseUrl) {
                throw new Error('BRI provider not initialized')
            }

            const accessToken = await this.getAccessToken()
            const timestamp = new Date().toISOString()
            const url = `/v1/briva/${this.config.merchantId}/${orderId}` // Adjust based on actual endpoint

            // Generate signature for GET request
            const signature = this.generateSignature('GET', url, accessToken, '', timestamp)

            const response = await fetch(`${this.baseUrl}${url}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'BRI-Timestamp': timestamp,
                    'BRI-Signature': signature
                }
            })

            if (!response.ok) {
                throw new Error('Failed to check payment status')
            }

            const data = await response.json()

            // Map BRI status to our standard status
            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

            // TODO: Customize based on actual BRI status codes
            if (data.statusBayar === 'Y' || data.status === 'PAID') {
                status = 'PAID'
            } else if (data.status === 'EXPIRED') {
                status = 'EXPIRED'
            } else {
                status = 'PENDING'
            }

            return {
                orderId,
                status,
                paidAt: data.paymentDate ? new Date(data.paymentDate) : undefined,
                paymentMethod: 'BRI Virtual Account',
                amount: parseFloat(data.amount || '0'),
                transactionId: data.trxId
            }
        } catch (error: any) {
            console.error('BRI checkStatus error:', error)
            throw error
        }
    }

    async cancelPayment(orderId: string): Promise<void> {
        // BRI Virtual Account biasanya tidak support cancel, akan expired otomatis
        console.log(`BRI VA will auto-expire for order: ${orderId}`)
    }

    verifyWebhook(payload: any, signature?: string): boolean {
        try {
            if (!this.config || !signature) {
                return false
            }

            // TODO: Implement BRI webhook signature verification
            // Based on BRI documentation for webhook security
            const timestamp = payload.timestamp || ''
            const bodyString = JSON.stringify(payload)

            // Verify signature matches
            const expectedSignature = this.generateSignature(
                'POST',
                '/webhook/bri',
                '',
                bodyString,
                timestamp
            )

            return signature === expectedSignature
        } catch (error) {
            console.error('BRI webhook verification error:', error)
            return false
        }
    }

    async processWebhook(payload: any): Promise<WebhookResult> {
        try {
            // TODO: Customize based on actual BRI webhook payload structure
            const orderId = payload.custCode || payload.brivaNo

            let status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

            if (payload.statusBayar === 'Y') {
                status = 'PAID'
            } else {
                status = 'PENDING'
            }

            return {
                orderId,
                status,
                paidAt: payload.paymentDate ? new Date(payload.paymentDate) : undefined,
                paymentMethod: 'BRI Virtual Account',
                transactionId: payload.trxId,
                amount: parseFloat(payload.amount || '0'),
                raw: payload
            }
        } catch (error: any) {
            console.error('BRI processWebhook error:', error)
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

            // Test by getting access token
            const accessToken = await this.getAccessToken()

            if (accessToken) {
                return {
                    success: true,
                    message: 'Connection successful - Access token obtained',
                    details: {
                        baseUrl: this.baseUrl,
                        environment: this.config.isProduction ? 'Production' : 'Sandbox'
                    }
                }
            }

            return {
                success: false,
                message: 'Failed to obtain access token'
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
