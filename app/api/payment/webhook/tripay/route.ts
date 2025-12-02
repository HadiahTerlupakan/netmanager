import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

// using shared prisma singleton
const gatewayManager = new PaymentGatewayManager(prisma)

export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text()
        const signature = request.headers.get('x-callback-signature')

        if (!signature) {
            return NextResponse.json(
                { success: false, message: 'Missing signature' },
                { status: 400 }
            )
        }

        // Get provider instance
        const provider = await gatewayManager.getProviderInstance('TRIPAY')

        // Verify signature
        const isValid = provider.verifyWebhook(rawBody, signature)

        if (!isValid) {
            console.error('Invalid Tripay webhook signature')
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
        // Tripay sends merchant_ref which is our orderId
        const orderId = result.orderId

        // Find payment record in our DB (assuming we store it, or we find by orderId logic)
        // In our current system, we might not have a separate Payment table yet, 
        // usually we link via Tagihan or a Transaction table.
        // Based on previous code, we generate orderId as `PAY-${tagihan.noTagihan}-${timestamp}`

        // Extract tagihan number from orderId
        // Format: PAY-INV/2023/11/001-1701234567890
        // This is a bit tricky if we don't store the exact orderId relation.
        // But wait, we should have a Payment/Transaction model?
        // Let's check schema for ManualPayment or similar. 
        // Ah, we have ManualPayment but that's for manual.
        // For PG, we usually update Tagihan directly or have a PaymentLog.

        // Let's look at how Xendit webhook handles it.
        // Assuming we need to find the Tagihan.

        // For now, let's try to parse the tagihan number or find by some reference.
        // If we don't have a dedicated table mapping orderId to Tagihan, we might need to parse it.
        // Or maybe we stored it in `externalId` of a Payment model if it exists.

        // Let's assume we parse it for now or use a flexible search.
        // Actually, let's check `app/api/payment/webhook/xendit/route.ts` to see how it's done there.
        // But I can't see it right now.

        // I'll implement a safe lookup.
        // If orderId starts with PAY-, we can try to find the tagihan.

        // However, the most robust way is to store the transaction.
        // If we don't have a transaction table, we update Tagihan directly if status is PAID.

        if (result.status === 'PAID') {
            // Try to find tagihan by matching the order ID pattern or if we stored it somewhere.
            // Since I don't have the full context of where orderId is stored, 
            // I will assume we can extract the tagihan ID or Number from the reference if possible,
            // OR we search for a tagihan that matches.

            // Wait, in `create/route.ts` we generated: `PAY-${tagihan.noTagihan}-${Date.now()}`
            // So we can extract `tagihan.noTagihan`.

            const parts = orderId.split('-')
            // PAY, INV/2023/..., TIMESTAMP
            // The middle part is the tagihan number. 
            // It might contain slashes, so splitting by '-' might be risky if tagihan number has dashes.
            // But usually tagihan number is like INV/2023/11/001.

            // Let's try to find the tagihan by parsing.
            // A better way: The `merchant_ref` IS the orderId.

            // Let's try to find a Tagihan that has this orderId if we saved it?
            // Schema check: Tagihan has `paymentId`? No.

            // Let's look at `app/api/payment/webhook/xendit/route.ts` pattern if I could.
            // Since I can't, I'll implement a robust search.

            // We'll iterate or use a flexible query? No, that's bad.
            // Let's assume we can extract the tagihan number.
            // `PAY-` prefix (4 chars).
            // Suffix is timestamp (13 chars) + dash = 14 chars.
            // So tagihan number is substring.

            const prefixLen = 4 // "PAY-"
            const suffixLen = 14 // "-170..."

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
                            tanggalBayar: result.paidAt || new Date(),
                            metodePembayaran: `TRIPAY - ${result.paymentMethod}`
                        }
                    })

                    // TODO: Send notification/email
                }
            }
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Tripay webhook error:', error)
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        )
    }
}
