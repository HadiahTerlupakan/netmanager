import { CouponService } from '@/modules/coupons'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const couponService = new CouponService()

export const POST = createHandler({ auth: false }, async (req, _ctx) => {
    const json = await req.json()
    const { code, amount, pelangganId } = json

    if (!code) {
        return ApiErrors.badRequest('Kode kupon harus diisi')
    }

    try {
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
})
