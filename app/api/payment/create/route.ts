import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

const prisma = new PrismaClient()
const gatewayManager = new PaymentGatewayManager(prisma)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tagihanId, preferredProvider } = body

        if (!tagihanId) {
            return NextResponse.json(
                { error: 'Missing required field: tagihanId' },
                { status: 400 }
            )
        }

        // Get tagihan
        const tagihan = await prisma.tagihan.findUnique({
            where: { id: tagihanId },
            include: {
                pelanggan: true
            }
        })

        if (!tagihan) {
            return NextResponse.json(
                { error: 'Tagihan not found' },
                { status: 404 }
            )
        }

        if (tagihan.status === 'LUNAS') {
            return NextResponse.json(
                { error: 'Tagihan already paid' },
                { status: 400 }
            )
        }

        // Generate order ID
        const orderId = `PAY-${tagihan.noTagihan}-${Date.now()}`

        // Create payment
        const paymentParams = {
            orderId,
            amount: Number(tagihan.total),
            customerName: tagihan.pelanggan.nama,
            customerEmail: tagihan.pelanggan.email || 'noreply@netmanager.com',
            customerPhone: tagihan.pelanggan.noTelp || '081234567890',
            description: `Payment for Invoice ${tagihan.noTagihan}`,
            expiryHours: 24
        }

        let result
        if (preferredProvider) {
            result = await gatewayManager.createPaymentWithProvider(preferredProvider, paymentParams)
        } else {
            result = await gatewayManager.createPayment(paymentParams)
        }

        if (!result.success) {
            return NextResponse.json(
                { error: 'Failed to create payment', details: result.error },
                { status: 500 }
            )
        }

        // Get the provider that was used
        const providerConfig = preferredProvider
            ? await prisma.paymentGatewayConfig.findUnique({ where: { provider: preferredProvider } })
            : await gatewayManager.getBestProvider()

        // Save transaction to database
        const transaction = await prisma.paymentGatewayTransaction.create({
            data: {
                provider: providerConfig!.provider,
                orderId,
                transactionId: result.transactionId,
                tagihanId,
                amount: BigInt(paymentParams.amount),
                status: 'PENDING',
                paymentUrl: result.paymentUrl,
                qrCodeUrl: result.qrCodeUrl,
                vaNumber: result.vaNumber,
                expiredAt: result.expiresAt,
                customerEmail: paymentParams.customerEmail,
                customerPhone: paymentParams.customerPhone
            }
        })

        // Create/update payment link
        await prisma.paymentLink.upsert({
            where: { tagihanId },
            create: {
                tagihanId,
                linkToken: orderId,
                paymentUrl: result.paymentUrl || '',
                isActive: true,
                expiresAt: result.expiresAt
            },
            update: {
                linkToken: orderId,
                paymentUrl: result.paymentUrl || '',
                isActive: true,
                expiresAt: result.expiresAt
            }
        })

        return NextResponse.json({
            success: true,
            orderId,
            transactionId: result.transactionId,
            paymentUrl: result.paymentUrl,
            qrCodeUrl: result.qrCodeUrl,
            vaNumber: result.vaNumber,
            expiresAt: result.expiresAt
        })
    } catch (error: any) {
        console.error('Error creating payment:', error)
        return NextResponse.json(
            { error: 'Failed to create payment', details: error.message },
            { status: 500 }
        )
    }
}
