
import { NextRequest } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const couponService = new CouponService()

export async function POST(req: NextRequest) {
    try {
        const json = await req.json()
        const { code, amount, pelangganId } = json

        if (!code) {
            return ApiErrors.badRequest('Kode kupon harus diisi')
        }

        const result = await couponService.verifyCoupon(code, Number(amount), pelangganId)

        if (!result.valid) {
            return ApiErrors.badRequest(result.error || 'Kupon tidak valid')
        }

        return apiSuccess({
            valid: true,
            code: code.toUpperCase(),
            discountAmount: result.discountAmount,
            finalAmount: result.finalAmount,
            couponId: result.couponId
        })

    } catch (error: unknown) {
        console.error('Coupon verify error:', error)
        const message = error instanceof Error ? error.message : 'Gagal memverifikasi kupon'
        return ApiErrors.internalError(message)
    }
}
