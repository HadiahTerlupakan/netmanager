import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

const prisma = new PrismaClient()
const gatewayManager = new PaymentGatewayManager(prisma)

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text()
        const signature = request.headers.get('x-dana-signature') || 
                         request.headers.get('x-signature') ||
                         request.headers.get('signature')

        if (!signature) {
            return NextResponse.json(
                { success: false, message: 'Missing signature' },
                { status: 400 }
            )
        }

        // Get provider instance
        const provider = await gatewayManager.getProviderInstance('DANA')

        // Verify signature
        const isValid = provider.verifyWebhook(rawBody, signature)

        if (!isValid) {
            console.error('Invalid DANA webhook signature')
            return NextResponse.json(
                { success: false, message: 'Invalid signature' },
                { status: 400 }
            )
        }

        // Parse body
        const payload = JSON.parse(rawBody)

        // Process webhook
        const result = await provider.processWebhook(payload)

        // Find transaction
        // DANA sends merchantOrderId which is our orderId
        const orderId = result.orderId

        // Extract tagihan number from orderId
        // Format: PAY-INV/2023/11/001-1701234567890
        const prefixLen = 4 // "PAY-"
        const suffixLen = 14 // "-170..."

        if (result.status === 'PAID') {
            if (orderId.length > prefixLen + suffixLen) {
                const noTagihan = orderId.substring(prefixLen, orderId.length - suffixLen)

                const tagihan = await prisma.tagihan.findUnique({
                    where: { noTagihan }
                })

                if (tagihan && tagihan.status !== 'LUNAS') {
                    // Update tagihan status
                    await prisma.tagihan.update({
                        where: { id: tagihan.id },
                        data: {
                            status: 'LUNAS',
                            tglBayar: result.paidAt || new Date(),
                            metodePembayaran: `DANA - ${result.paymentMethod || 'DANA'}`
                        }
                    })

                    // TODO: Send notification/email
                }
            }
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('DANA webhook error:', error)
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        )
    }
}

