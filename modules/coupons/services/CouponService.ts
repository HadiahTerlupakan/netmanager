
import { Prisma } from '@prisma/client'
import type { ICouponRepository, CreateCouponInput, VerifyCouponResult } from '../repositories/ICouponRepository'
import { CouponRepository } from '../repositories/CouponRepository'

export class CouponService {
    private repo: ICouponRepository

    constructor(repo?: ICouponRepository) {
        this.repo = repo || new CouponRepository()
    }

    async getAllCoupons() {
        return this.repo.findAll()
    }

    async createCoupon(data: CreateCouponInput) {
        const existing = await this.repo.findByCode(data.code)
        if (existing) throw new Error('Coupon code already exists')
        return this.repo.create(data)
    }

    async verifyCoupon(code: string, amount: number, _pelangganId?: string): Promise<VerifyCouponResult> {
        if (!code) return { valid: false, error: 'Kode diperlukan', discountAmount: 0, finalAmount: amount }

        const coupon = await this.repo.findByCode(code.toUpperCase())
        if (!coupon) return { valid: false, error: 'Kupon tidak ditemukan', discountAmount: 0, finalAmount: amount }

        const now = new Date()
        if (!coupon.isActive) return { valid: false, error: 'Kupon tidak aktif', discountAmount: 0, finalAmount: amount }
        if (now < coupon.startDate || now > coupon.endDate) {
            return { valid: false, error: 'Kupon kadaluarsa atau belum berlaku', discountAmount: 0, finalAmount: amount }
        }
        if (coupon.quota > 0 && coupon.usedCount >= coupon.quota) {
            return { valid: false, error: 'Kuota kupon habis', discountAmount: 0, finalAmount: amount }
        }
        if (amount < coupon.minTransaction) {
            return { valid: false, error: `Minimal transaksi Rp ${coupon.minTransaction.toLocaleString('id-ID')}`, discountAmount: 0, finalAmount: amount }
        }

        // Calculate Discount
        let discount = 0
        if (coupon.discountType === 'FIXED') {
            discount = coupon.discountValue
        } else {
            discount = (amount * coupon.discountValue) / 100
            if (coupon.maxDiscount && discount > coupon.maxDiscount) {
                discount = coupon.maxDiscount
            }
        }

        if (discount > amount) discount = amount

        return {
            valid: true,
            discountAmount: Math.floor(discount),
            finalAmount: Math.floor(amount - discount),
            couponId: coupon.id
        }
    }

    async recordUsage(couponId: string, pelangganId: string, tx?: Prisma.TransactionClient) {
        return this.repo.recordUsage(couponId, pelangganId, tx)
    }

    async incrementUsage(couponId: string, tx?: Prisma.TransactionClient) {
        return this.repo.incrementUsage(couponId, tx)
    }

    async deleteCoupon(id: string) {
        // Check if coupon exists
        const coupon = await this.repo.findById(id)
        if (!coupon) throw new Error('Coupon not found')

        // Check if coupon has been used
        if (coupon.usedCount > 0) {
            throw new Error('Cannot delete coupon that has been used')
        }

        return this.repo.delete(id)
    }
}
