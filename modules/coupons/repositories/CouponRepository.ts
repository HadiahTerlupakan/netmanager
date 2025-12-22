
import { PrismaClient, Prisma } from '@prisma/client'
import type { Coupon, CouponUsage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
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
                skip,
                take
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
        return this.db.coupon.create({ data })
    }

    async incrementUsage(id: string, tx?: Prisma.TransactionClient): Promise<Coupon> {
        const db = tx || this.db
        // Cast to any to bypass potential typing issues with the transaction client if strictly typed
        const delegate = (db as any).coupon
        return delegate.update({
            where: { id },
            data: { usedCount: { increment: 1 } }
        })
    }

    async recordUsage(couponId: string, pelangganId: string, tx?: Prisma.TransactionClient): Promise<CouponUsage> {
        const db = tx || this.db
        const delegate = (db as any).couponUsage
        return delegate.create({
            data: {
                couponId,
                pelangganId,
                usedAt: new Date()
            }
        })
    }
}
