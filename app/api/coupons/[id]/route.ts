import { CouponService } from '@/modules/coupons'
import { hasPermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, apiError, ErrorCodes, createHandler } from '@/lib/api'

const couponService = new CouponService()

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('coupon:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus kupon')
    }

    const { id } = ctx.params

    try {
        await couponService.deleteCoupon(id)

        await logger.logActivity({
            action: 'DELETE',
            subject: 'Coupon',
            details: { id },
            userId: ctx.session!.user.id
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
})
