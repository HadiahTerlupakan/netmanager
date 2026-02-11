
import { NextRequest } from 'next/server'
import { CouponService } from '@/modules/coupons/services/CouponService'
import { hasPermission } from '@/lib/rbac'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const couponService = new CouponService()

export async function GET(_req: NextRequest) {
    try {
        if (!await hasPermission('coupon:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data kupon')
        }

        const result = await couponService.getAllCoupons()
        return apiSuccess(result.items)
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil data kupon'
        return ApiErrors.internalError(errorMessage)
    }
}

export async function POST(req: NextRequest) {
    try {
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

        return apiSuccess(coupon, { status: 201, message: 'Kupon berhasil dibuat' })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Gagal membuat kupon'
        if (errorMessage === 'Coupon code already exists') {
            return ApiErrors.conflict('Kode kupon sudah digunakan, silakan gunakan kode lain')
        }
        return ApiErrors.internalError(errorMessage)
    }
}
