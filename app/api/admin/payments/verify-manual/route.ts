import { NextRequest, NextResponse } from 'next/server'
import { prismaBilling } from '@/lib/prisma-billing'
import { AutomaticBillingService } from '@/modules/finance/services/AutomaticBillingService'
import { sendCustomerPushNotification } from '@/modules/notification/services/ExpoPushService'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { paymentId, action, notes } = body

        if (!paymentId || !action) {
            return NextResponse.json({ success: false, error: 'Bad Request' }, { status: 400 })
        }

        const payment = await prismaBilling.payment.findUnique({
            where: { id: paymentId },
            include: { invoice: true }
        })

        if (!payment || payment.gatewayStatus !== 'PENDING') {
            return NextResponse.json({ success: false, error: 'Payment not found or already processed' }, { status: 404 })
        }

        if (action === 'REJECT') {
            await prismaBilling.payment.update({
                where: { id: paymentId },
                data: { gatewayStatus: 'FAILED', notes: notes || payment.notes }
            })

            if (payment.invoice?.pelangganId) {
                await sendCustomerPushNotification(
                    payment.invoice.pelangganId,
                    'Pembayaran Ditolak',
                    'Pembayaran Anda ditolak. Mohon periksa kembali bukti transfer Anda.',
                    { paymentId: payment.id, invoiceId: payment.invoiceId, action: 'REJECT' }
                )
            }

            return NextResponse.json({ success: true, message: 'Payment rejected' })
        }

        if (action === 'APPROVE') {
            await prismaBilling.payment.update({
                where: { id: paymentId },
                data: {
                    gatewayStatus: 'PAID',
                    paymentDate: new Date(),
                    notes: notes || payment.notes
                }
            })

            // Update Invoice Paid Amount
            if (payment.invoiceId) {
                const invoice = await prismaBilling.invoice.findUnique({
                    where: { id: payment.invoiceId },
                    include: { payment: true },
                })

                if (invoice) {
                    const totalPaid = invoice.payment.reduce((sum, p) => {
                        // The newly approved payment's status in the db is already updated above, but in the `invoice.payment` snapshot it might still be PENDING if include caches it.
                        if (p.id === paymentId) return sum + p.amount;

                        if (!p.gatewayStatus || p.gatewayStatus === 'PAID') {
                            return sum + p.amount
                        }
                        return sum
                    }, BigInt(0))

                    let invoiceStatus: string
                    if (totalPaid >= invoice.totalAmount) {
                        invoiceStatus = 'PAID'
                    } else if (totalPaid > BigInt(0)) {
                        invoiceStatus = 'PARTIAL_PAID'
                    } else {
                        invoiceStatus = invoice.status
                    }

                    await prismaBilling.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            paidAmount: totalPaid,
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            status: invoiceStatus as any,
                            ...(invoiceStatus === 'PAID' ? { paidAt: new Date() } : {}),
                        },
                    })

                    if (invoiceStatus === 'PAID') {
                        await AutomaticBillingService.handleInvoicePaid(invoice.id);
                    }
                }

                await sendCustomerPushNotification(
                    payment.invoice.pelangganId,
                    'Pembayaran Berhasil!',
                    'Tagihan Anda telah dilunasi.',
                    { paymentId: payment.id, invoiceId: payment.invoiceId, action: 'APPROVE' }
                )
            }

            return NextResponse.json({ success: true, message: 'Payment approved' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })

    } catch (e) {
        const error = e as Error
        console.error('Error verifying manual payment:', error)
        return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
