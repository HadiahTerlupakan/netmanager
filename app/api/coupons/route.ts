
import { NextRequest, NextResponse } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { hasPermission } from '@/lib/rbac'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

const couponService = new CouponService()

export async function GET(_req: NextRequest) {
    try {
        if (!await hasPermission('coupon:read')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const result = await couponService.getAllCoupons()
        return NextResponse.json(result.items)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!await hasPermission('coupon:create')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
        }

        const json = await req.json()
        const {
            code,
            description,
            discountType,
            discountValue,
            startDate,
            endDate,
            minTransaction,
            maxDiscount,
            quota,
            isActive
        } = json

        if (!code || !discountType || discountValue === undefined || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const coupon = await couponService.createCoupon({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue: Number(discountValue),
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            minTransaction: Number(minTransaction || 0),
            ...(maxDiscount ? { maxDiscount: Number(maxDiscount) } : {}),
            quota: Number(quota || 0),
            isActive: isActive ?? true
        })

        const session = await getServerSession(authOptions)
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Coupon',
            details: { id: coupon.id, code: coupon.code },
            userId: session?.user?.id
        })

        return NextResponse.json(coupon)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        if (errorMessage === 'Coupon code already exists') {
            return NextResponse.json({ error: 'Kode kupon sudah ada' }, { status: 409 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
