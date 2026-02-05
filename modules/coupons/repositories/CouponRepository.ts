import { PrismaClient, Prisma } from '@prisma/client'
import type { Coupon, CouponUsage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import type { ICouponRepository, CreateCouponInput } from './ICouponRepository'

export class CouponRepository implements ICouponRepository {
    private db: PrismaClient

    constructor() {
        this.db = prisma
    }

    async findAll(params?: { skip?: number; take?: number }): Promise<{ items: Coupon[]; total: number }> {
        const { skip, take } = params || {}
        const [items, total] = await Promise.all([
            this.db.coupon.findMany({
                orderBy: { createdAt: 'desc' },
                ...(skip !== undefined ? { skip } : {}),
                ...(take !== undefined ? { take } : {})
            }),
            this.db.coupon.count()
        ])
        return { items, total }
    }

    async findById(id: string): Promise<Coupon | null> {
        return this.db.coupon.findUnique({ where: { id } })
    }

    async findByCode(code: string): Promise<Coupon | null> {
        return this.db.coupon.findUnique({ where: { code } })
    }

    async create(data: CreateCouponInput): Promise<Coupon> {
        return this.db.coupon.create({
            data: {
                id: randomUUID(),
                ...data,
                updatedAt: new Date(),
            }
        })
    }

    async incrementUsage(id: string, tx?: Prisma.TransactionClient): Promise<Coupon> {
        const db = tx || this.db
        // Use unknown as intermediate cast to avoid direct any
        const delegate = (db as unknown as { coupon: Prisma.CouponDelegate<undefined> }).coupon
        return delegate.update({
            where: { id },
            data: { usedCount: { increment: 1 } }
        })
    }

    async recordUsage(couponId: string, pelangganId: string, tx?: Prisma.TransactionClient): Promise<CouponUsage> {
        const db = tx || this.db
        const delegate = (db as unknown as { couponUsage: Prisma.CouponUsageDelegate<undefined> }).couponUsage
        return delegate.create({
            data: {
                id: randomUUID(),
                couponId,
                pelangganId,
                usedAt: new Date()
            }
        })
    }

    async delete(id: string): Promise<void> {
        await this.db.coupon.delete({ where: { id } })
    }
}
