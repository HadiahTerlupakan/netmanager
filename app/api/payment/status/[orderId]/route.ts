import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PaymentGatewayManager } from '@/lib/services/payment-gateway/gateway-manager'

// using shared prisma singleton
const gatewayManager = new PaymentGatewayManager(prisma)

export async function GET(
    request: NextRequest,
    { params }: { params: { orderId: string } }
) {
    try {
        const orderId = params.orderId

        // Get transaction from database
        const transaction = await prisma.paymentGatewayTransaction.findUnique({
            where: { orderId },
            include: {
                tagihan: {
                    include: {
                        pelanggan: true
                    }
                }
            }
        })

        if (!transaction) {
            return NextResponse.json(
                { error: 'Transaction not found' },
                { status: 404 }
            )
        }

        // Check latest status from provider
        try {
            const status = await gatewayManager.checkPaymentStatus(
                transaction.provider,
                orderId
            )

            // Update transaction if status changed
            if (status.status !== transaction.status) {
                await prisma.paymentGatewayTransaction.update({
                    where: { orderId },
                    data: {
                        status: status.status,
                        paidAt: status.paidAt,
                        paymentMethod: status.paymentMethod
                    }
                })

                // Update Tagihan if paid
                if (status.status === 'PAID') {
                    await prisma.tagihan.update({
                        where: { id: transaction.tagihanId },
                        data: {
                            status: 'LUNAS',
                            tanggalBayar: status.paidAt || new Date(),
                            metodePembayaran: `ONLINE_${transaction.provider}`
                        }
                    })
                }
            }

            return NextResponse.json({
                orderId,
                status: status.status,
                amount: Number(transaction.amount),
                paymentUrl: transaction.paymentUrl,
                qrCodeUrl: transaction.qrCodeUrl,
                vaNumber: transaction.vaNumber,
                paidAt: status.paidAt,
                expiresAt: transaction.expiredAt,
                tagihan: {
                    noTagihan: transaction.tagihan.noTagihan,
                    pelanggan: transaction.tagihan.pelanggan.nama
                }
            })
        } catch (error) {
            // If provider check fails, return DB status
            return NextResponse.json({
                orderId,
                status: transaction.status,
                amount: Number(transaction.amount),
                paymentUrl: transaction.paymentUrl,
                qrCodeUrl: transaction.qrCodeUrl,
                vaNumber: transaction.vaNumber,
                paidAt: transaction.paidAt,
                expiresAt: transaction.expiredAt,
                tagihan: {
                    noTagihan: transaction.tagihan.noTagihan,
                    pelanggan: transaction.tagihan.pelanggan.nama
                }
            })
        }
    } catch (error: any) {
        console.error('Error checking payment status:', error)
        return NextResponse.json(
            { error: 'Failed to check payment status', details: error.message },
            { status: 500 }
        )
    }
}
