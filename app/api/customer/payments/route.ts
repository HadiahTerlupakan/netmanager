import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'
import { PelangganService } from '@/modules/pelanggan'
import { CouponService } from '@/modules/coupons/services/CouponService'

const pelangganService = new PelangganService()
const couponService = new CouponService()

/**
 * GET - Get payment history
 * Refactored to use PelangganService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')

        const result = await pelangganService.getPaymentHistory(
            authResult.session.id,
            page,
            limit
        )

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error: any) {
        console.error('[Customer Payments GET Error]:', error)
        return NextResponse.json(
            { error: error.message || 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}

/**
 * POST - Create payment
 * Uses PelangganService for invoice validation, CouponService for coupon handling
 */
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

        // 1. Validate invoices using service
        const { invoices, totalAmount } = await pelangganService.validateInvoicesForPayment(
            invoiceIds,
            authResult.session.id
        )

        let discountAmount = 0
        let couponId = null

        // 2. Validate Coupon using Service
        if (couponCode) {
            const verification = await couponService.verifyCoupon(
                couponCode, 
                totalAmount, 
                authResult.session.id
            )

            if (!verification.valid) {
                return NextResponse.json({ error: verification.error }, { status: 400 })
            }

            discountAmount = verification.discountAmount
            couponId = verification.couponId
        }

        const finalAmount = totalAmount - discountAmount

        // 3. Create Payment & Update (transaction still needed for atomicity)
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
        
        if (error.message === 'Beberapa tagihan tidak valid atau sudah dibayar') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }
        
        return NextResponse.json(
            { error: error.message || 'Gagal memproses pembayaran' }, 
            { status: 500 }
        )
    }
}
