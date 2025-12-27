import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'
import { CouponService } from '@/modules/coupons/services/CouponService'

const couponService = new CouponService()

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        // Get customer ID
        const customer = await prisma.pelanggan.findUnique({
            where: { id: authResult.session.id },
            select: { id: true },
        })

        if (!customer) {
            return NextResponse.json(
                { error: 'Data pelanggan tidak ditemukan' },
                { status: 404 }
            )
        }

        // Get payments with pagination
        const [payments, total] = await Promise.all([
            prisma.payment.findMany({
                where: { pelangganId: customer.id },
                orderBy: { paymentDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    invoice: {
                        select: {
                            invoiceNumber: true,
                            status: true,
                        },
                    },
                },
            }),
            prisma.payment.count({ where: { pelangganId: customer.id } }),
        ])

        // Format response
        const formattedPayments = payments.map((pay) => ({
            id: pay.id,
            amount: Number(pay.amount),
            paymentDate: pay.paymentDate,
            paymentMethod: pay.paymentMethod,
            reference: pay.reference,
            notes: pay.notes,
            invoice: pay.invoice ? {
                invoiceNumber: pay.invoice.invoiceNumber,
                status: pay.invoice.status,
            } : null,
            verified: !!pay.verifiedAt,
        }))

        // Calculate summary
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)

        return NextResponse.json({
            success: true,
            payments: formattedPayments,
            summary: {
                totalPaid,
                transactionCount: total,
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } catch (error) {
        console.error('[Customer Payments Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}


export async function POST(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const json = await request.json()
        const { invoiceIds, couponCode, paymentMethod, notes } = json

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json(
                { error: 'Pilih minimal satu tagihan untuk dibayar' },
                { status: 400 }
            )
        }

        // 1. Get Invoices to pay - Ensure only SENT/OVERDUE
        const invoices = await prisma.invoice.findMany({
            where: {
                id: { in: invoiceIds },
                pelangganId: authResult.session.id,
                status: { in: ['SENT', 'OVERDUE'] }
            }
        })

        if (invoices.length !== invoiceIds.length) {
            return NextResponse.json(
                { error: 'Beberapa tagihan tidak valid atau sudah dibayar' },
                { status: 400 }
            )
        }

        let totalAmount = invoices.reduce((sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)), 0)
        let discountAmount = 0
        let couponId = null

        // 2. Validate Coupon using Service
        if (couponCode) {
            const verification = await couponService.verifyCoupon(couponCode, totalAmount, authResult.session.id)

            if (!verification.valid) {
                return NextResponse.json({ error: verification.error }, { status: 400 })
            }

            discountAmount = verification.discountAmount
            couponId = verification.couponId
        }

        const finalAmount = totalAmount - discountAmount

        // 3. Create Payment & Update
        const result = await prisma.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    id: crypto.randomUUID(),
                    updatedAt: new Date(),
                    amount: finalAmount,
                    paymentDate: new Date(),
                    paymentMethod: (paymentMethod === 'MANUAL' ? 'OTHER' : paymentMethod) || 'OTHER',
                    reference: `PAY-${Date.now()}`,
                    notes: notes,
                    pelangganId: authResult.session.id,
                    invoiceId: invoiceIds[0]
                }
            })

            // Record Coupon Usage via Service (passing tx)
            if (couponId) {
                await couponService.recordUsage(couponId, authResult.session.id, tx)
                await couponService.incrementUsage(couponId, tx)
            }

            return payment
        })

        return NextResponse.json({ success: true, payment: result })

    } catch (error: any) {
        console.error('[Payment Create Error]:', error)
        return NextResponse.json({ error: error.message || 'Gagal memproses pembayaran' }, { status: 500 })
    }
}
