
import { NextRequest } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { hasPermission } from '@/lib/rbac'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, apiError, ErrorCodes } from '@/lib/api-response'

const couponService = new CouponService()

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return ApiErrors.unauthorized('Tidak terautentikasi')
        }

        if (!await hasPermission('coupon:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus kupon')
        }

        const { id } = await params

        await couponService.deleteCoupon(id)

        await logger.logActivity({
            action: 'DELETE',
            subject: 'Coupon',
            details: { id },
            userId: session.user?.id
        })

        return apiSuccess(null, { message: 'Kupon berhasil dihapus' })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Gagal menghapus kupon'
        if (errorMessage === 'Coupon not found') {
            return ApiErrors.notFound('Kupon')
        }
        if (errorMessage.includes('has been used')) {
            return apiError('Kupon tidak bisa dihapus karena sudah pernah digunakan', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }
        return ApiErrors.internalError(errorMessage)
    }
}
