import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

const gatewayManager = new PaymentGatewayManager(prisma)

interface RouteContext {
    params: Promise<{ provider: string }>
}

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    const { provider: providerParam } = await context.params

    try {
        const provider = providerParam.toUpperCase()

        // Get raw body for signature verification
        const body = await request.text()
        const payload = JSON.parse(body)

        // Get signature from headers (provider-specific)
        const signature = request.headers.get('x-callback-token') ||
            request.headers.get('x-signature') ||
            payload.signature_key

        // Process webhook
        const result = await gatewayManager.processWebhook(provider, payload, signature)

        // Update transaction in database
        const transaction = await prisma.paymentGatewayTransaction.findUnique({
            where: { orderId: result.orderId }
        })

        if (!transaction) {
            console.error(`Transaction not found for order: ${result.orderId}`)
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
        }

        // Update transaction status
        await prisma.paymentGatewayTransaction.update({
            where: { orderId: result.orderId },
            data: {
                status: result.status,
                paidAt: result.paidAt,
                paymentMethod: result.paymentMethod,
                transactionId: result.transactionId || transaction.transactionId,
                webhookReceived: true,
                webhookData: result.raw
            }
        })

        // If payment successful, update Tagihan status
        if (result.status === 'PAID') {
            await prisma.tagihan.update({
                where: { id: transaction.tagihanId },
                data: {
                    status: 'LUNAS',
                    tanggalBayar: result.paidAt || new Date(),
                    metodePembayaran: `ONLINE_${provider}`,
                    catatan: `Paid via ${provider} - Transaction ID: ${result.transactionId}`
                }
            })

            console.log(`✅ Payment successful for order ${result.orderId}`)
        }

        // If payment expired or failed, mark as inactive
        if (result.status === 'EXPIRED' || result.status === 'FAILED' || result.status === 'CANCELLED') {
            await prisma.paymentLink.updateMany({
                where: { tagihanId: transaction.tagihanId },
                data: { isActive: false }
            })

            console.log(`❌ Payment ${result.status} for order ${result.orderId}`)
        }

        return NextResponse.json({ success: true, status: result.status })
    } catch (error: any) {
        console.error(`Webhook processing error (${providerParam}):`, error)

        // Still return 200 to prevent provider from retrying
        // Log the error for manual review
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 200 }
        )
    }
}
