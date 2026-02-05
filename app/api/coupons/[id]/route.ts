
import { NextRequest, NextResponse } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { hasPermission } from '@/lib/rbac'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const couponService = new CouponService()

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!await hasPermission('coupon:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const user = session.user as { role?: string; siteId?: string }
        const userRole = user.role
        const _isSuperAdmin = userRole === 'SUPER_ADMIN' || userRole === 'Super Admin'
        // siteId check removed from service, so we don't pass it here for now
        // if we want to enforce it later, the Coupon model needs siteId field

        await couponService.deleteCoupon(id)

        return NextResponse.json({ success: true })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        if (errorMessage === 'Coupon not found') {
            return NextResponse.json({ error: errorMessage }, { status: 404 })
        }
        if (errorMessage.includes('has been used')) {
            return NextResponse.json({ error: errorMessage }, { status: 400 })
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
