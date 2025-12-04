import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'
import crypto from 'crypto'

// using shared prisma singleton
const gatewayManager = new PaymentGatewayManager(prisma)

// Store processed webhook hashes to prevent replay attacks (in production, use Redis)
const processedWebhooks = new Map<string, number>() // hash -> timestamp

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text()

        if (!rawBody || rawBody.trim().length === 0) {
            return NextResponse.json(
                { success: false, message: 'Empty request body' },
                { status: 400 }
            )
        }

        // Enhanced signature verification - check multiple possible headers
        const signatureHeaders = [
            'x-dana-signature',
            'x-signature',
            'signature',
            'x-webhook-signature',
            'webhook-signature'
        ]

        const signatures = []
        for (const header of signatureHeaders) {
            const sig = request.headers.get(header)
            if (sig) signatures.push({ header, value: sig })
        }

        if (signatures.length === 0) {
            console.error('[DANA Webhook] No signature headers found')
            return NextResponse.json(
                { success: false, message: 'Missing signature' },
                { status: 400 }
            )
        }

        // Get provider instance
        const provider = await gatewayManager.getProviderInstance('DANA')

        // Verify ALL signatures (defense in depth)
        let validSignatures = 0
        for (const { header, value } of signatures) {
            if (provider.verifyWebhook(rawBody, value)) {
                validSignatures++
            } else {
                console.warn(`[DANA Webhook] Invalid signature in header: ${header}`)
            }
        }

        if (validSignatures === 0) {
            console.error('[DANA Webhook] All signatures are invalid')
            return NextResponse.json(
                { success: false, message: 'Invalid signature' },
                { status: 400 }
            )
        }

        // Parse body with validation
        let payload
        try {
            payload = JSON.parse(rawBody)
        } catch (parseError) {
            console.error('[DANA Webhook] Invalid JSON payload:', parseError)
            return NextResponse.json(
                { success: false, message: 'Invalid JSON payload' },
                { status: 400 }
            )
        }

        // Replay attack protection
        const webhookHash = crypto.createHash('sha256').update(rawBody).digest('hex')
        const now = Date.now()
        const existingTimestamp = processedWebhooks.get(webhookHash)

        if (existingTimestamp && (now - existingTimestamp) < 300000) { // 5 minutes window
            console.warn('[DANA Webhook] Potential replay attack detected')
            return NextResponse.json(
                { success: false, message: 'Duplicate webhook' },
                { status: 409 }
            )
        }

        // Mark this webhook as processed
        processedWebhooks.set(webhookHash, now)

        // Clean old entries (older than 1 hour) to prevent memory leak
        const cutoff = now - 3600000
        for (const [hash, timestamp] of processedWebhooks.entries()) {
            if (timestamp < cutoff) {
                processedWebhooks.delete(hash)
            }
        }

        // Process webhook
        const result = await provider.processWebhook(payload)

        // Validate required fields
        if (!result.orderId) {
            console.error('[DANA Webhook] Missing orderId in webhook payload')
            return NextResponse.json(
                { success: false, message: 'Missing order information' },
                { status: 400 }
            )
        }

        // Find transaction with idempotency protection
        const orderId = result.orderId

        // Extract tagihan number from orderId with proper validation
        // Expected format: PAY-INV/2023/11/001-1701234567890
        const ORDER_ID_REGEX = /^PAY-([A-Z]+\/\d{4}\/\d{1,2}\/\d{1,3})-\d{13}$/

        if (result.status === 'PAID') {
            // Validate order ID format before extracting invoice number
            const orderIdMatch = orderId.match(ORDER_ID_REGEX)
            if (!orderIdMatch) {
                console.error('[DANA Webhook] Invalid order ID format:', orderId)
                return NextResponse.json(
                    { success: false, message: 'Invalid order ID format' },
                    { status: 400 }
                )
            }

            const noTagihan = orderIdMatch[1] // Extract invoice number from regex group

            // Verify that the invoice actually exists before processing
            const tagihan = await prisma.tagihan.findUnique({
                where: { noTagihan }
            })

            if (!tagihan) {
                console.error('[DANA Webhook] Invoice not found for tagihan number:', noTagihan)
                return NextResponse.json(
                    { success: false, message: 'Invoice not found' },
                    { status: 404 }
                )
            }

            // Process payment for valid invoice (idempotency check built-in)
            if (tagihan.status !== 'LUNAS') {
                // Use transaction for data consistency
                await prisma.$transaction(async (tx) => {
                    // Update tagihan status
                    await tx.tagihan.update({
                        where: { id: tagihan.id },
                        data: {
                            status: 'LUNAS',
                            tglBayar: result.paidAt || new Date(),
                            metodePembayaran: `DANA - ${result.paymentMethod || 'DANA'}`,
                            updatedBy: 'SYSTEM'
                        }
                    })

                    // Log transaction for audit
                    await tx.financialAuditLog.create({
                        data: {
                            action: 'PAYMENT_PROCESS',
                            entityType: 'WEBHOOK_DANA',
                            description: `DANA webhook payment processed for order ${orderId}`,
                            userId: 'SYSTEM',
                            userName: 'DANA Webhook System',
                            ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                            newValues: {
                                orderId: orderId,
                                provider: 'DANA',
                                amount: result.amount || 0,
                                status: 'SUCCESS',
                                noTagihan: noTagihan,
                                payload: payload,
                                processedAt: new Date().toISOString()
                            }
                        }
                    })
                })

                console.log(`[DANA Webhook] Successfully processed payment for tagihan ${noTagihan}`)
            } else {
                console.log(`[DANA Webhook] Tagihan ${noTagihan} already marked as LUNAS`)

                // Still log the webhook for audit
                await prisma.financialAuditLog.create({
                    data: {
                        action: 'PAYMENT_DUPLICATE',
                        entityType: 'WEBHOOK_DANA',
                        description: `Duplicate DANA webhook received for order ${orderId}`,
                        userId: 'SYSTEM',
                        userName: 'DANA Webhook System',
                        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                        newValues: {
                            orderId: orderId,
                            provider: 'DANA',
                            amount: result.amount || 0,
                            status: 'DUPLICATE',
                            noTagihan: noTagihan,
                            payload: payload,
                            processedAt: new Date().toISOString(),
                            note: 'Tagihan already LUNAS'
                        }
                    }
                })
            }
        } else {
            // Log non-payment status webhooks for audit
            await prisma.financialAuditLog.create({
                data: {
                    action: 'WEBHOOK_STATUS_UPDATE',
                    entityType: 'WEBHOOK_DANA',
                    description: `DANA webhook status update for order ${orderId}: ${result.status}`,
                    userId: 'SYSTEM',
                    userName: 'DANA Webhook System',
                    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
                    newValues: {
                        orderId: orderId,
                        provider: 'DANA',
                        amount: result.amount || 0,
                        status: result.status.toUpperCase(),
                        payload: payload,
                        processedAt: new Date().toISOString()
                    }
                }
            })
        }

        return NextResponse.json({
            success: true,
            message: 'Webhook processed successfully',
            orderId: orderId
        })

    } catch (error: any) {
        console.error('[DANA Webhook] Processing error:', error.message)

        // Don't expose internal error details
        return NextResponse.json(
            {
                success: false,
                message: 'Internal processing error',
                code: 'WEBHOOK_PROCESSING_ERROR'
            },
            { status: 500 }
        )
    }
}











