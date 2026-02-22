import { Prisma as PrismaBilling } from '@/prisma/generated/billing';

import type { Coupon, CouponUsage, DiscountType, Prisma } from '@prisma/client'

export interface CreateCouponInput {
    code: string
    description?: string
    discountType: DiscountType
    discountValue: number
    startDate: Date
    endDate: Date
    minTransaction: number
    maxDiscount?: number
    quota: number
    isActive: boolean
}

export interface VerifyCouponResult {
    valid: boolean
    error?: string
    discountAmount: number
    finalAmount: number
    couponId?: string
}

export interface ICouponRepository {
    findAll(params?: { skip?: number; take?: number }): Promise<{ items: Coupon[]; total: number }>
    findById(id: string): Promise<Coupon | null>
    findByCode(code: string): Promise<Coupon | null>
    create(data: CreateCouponInput): Promise<Coupon>
    incrementUsage(id: string, tx?: PrismaBilling.TransactionClient): Promise<Coupon>
    recordUsage(couponId: string, pelangganId: string, tx?: PrismaBilling.TransactionClient): Promise<CouponUsage>
    delete(id: string): Promise<void>
}
