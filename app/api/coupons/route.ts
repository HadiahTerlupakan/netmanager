import { CouponService } from '@/modules/coupons'
import { hasPermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

const couponService = new CouponService()

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('coupon:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data kupon')
    }

    const result = await couponService.getAllCoupons()
    return apiSuccess(result.items)
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('coupon:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat kupon')
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
        return ApiErrors.badRequest('Field wajib tidak lengkap: kode, tipe diskon, nilai diskon, tanggal mulai, dan tanggal berakhir harus diisi')
    }

    try {
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

        await logger.logActivity({
            action: 'CREATE',
            subject: 'Coupon',
            details: { id: coupon.id, code: coupon.code },
            userId: ctx.session!.user.id
        })

        return apiSuccess(coupon, { status: 201, message: 'Kupon berhasil dibuat' })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Gagal membuat kupon'
        if (errorMessage === 'Coupon code already exists') {
            return ApiErrors.conflict('Kode kupon sudah digunakan, silakan gunakan kode lain')
        }
        return ApiErrors.internalError(errorMessage)
    }
})
