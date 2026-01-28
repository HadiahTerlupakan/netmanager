import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'
import { PelangganService } from '@/modules/pelanggan'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

const pelangganService = new PelangganService()
const couponService = new CouponService()

/**
 * GET - Get payment history
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

        return apiSuccess(result)
    } catch (error: any) {
        console.error('[Customer Payments GET Error]:', error)
        return ApiErrors.internalError(error.message || 'Terjadi kesalahan server')
    }
}

/**
 * POST - Create payment
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
            return apiError('Pilih minimal satu tagihan untuk dibayar', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const { invoices, totalAmount } = await pelangganService.validateInvoicesForPayment(
            invoiceIds,
            authResult.session.id
        )

        let discountAmount = 0
        let couponId = null

        if (couponCode) {
            const verification = await couponService.verifyCoupon(
                couponCode, 
                totalAmount, 
                authResult.session.id
            )

            if (!verification.valid) {
                return apiError(verification.error || 'Kupon tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
            }

            discountAmount = verification.discountAmount
            couponId = verification.couponId
        }

        const finalAmount = totalAmount - discountAmount

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

            if (couponId) {
                await couponService.recordUsage(couponId, authResult.session.id, tx)
                await couponService.incrementUsage(couponId, tx)
            }

            return payment
        })

        return apiSuccess({ payment: result }, { message: 'Pembayaran berhasil diproses' })

    } catch (error: any) {
        console.error('[Payment Create Error]:', error)
        
        if (error.message === 'Beberapa tagihan tidak valid atau sudah dibayar') {
            return apiError(error.message, ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
        
        return ApiErrors.internalError(error.message || 'Gagal memproses pembayaran')
    }
}
