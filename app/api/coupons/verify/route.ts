
import { NextRequest, NextResponse } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'

const couponService = new CouponService()

export async function POST(req: NextRequest) {
    try {
        const json = await req.json()
        const { code, amount, pelangganId } = json

        if (!code) {
            return NextResponse.json({ valid: false, error: 'Kode kupon harus diisi' }, { status: 400 })
        }

        const result = await couponService.verifyCoupon(code, Number(amount), pelangganId)

        if (!result.valid) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json({
            valid: true,
            code: code.toUpperCase(), // Echo back the code
            discountAmount: result.discountAmount,
            finalAmount: result.finalAmount,
            couponId: result.couponId
        })

    } catch (error: any) {
        console.error('Coupon verify error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
