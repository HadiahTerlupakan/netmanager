import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import type { CreateCouponInput } from "../dto/CouponDTO";
import type {
  CouponEntity,
  CouponUsageEntity,
} from "../domain/entities/CouponEntity";
import type { ICouponRepository } from "../domain/ports/ICouponRepository";
import { CouponMapper } from "../mappers/CouponMapper";

/**
 * Prisma-backed coupon repository implementation.
 */
export class CouponRepository implements ICouponRepository {
  private readonly db: PrismaClient;

  constructor(database: PrismaClient = prisma) {
    this.db = database;
  }

  /**
   * Get all coupons with total count.
   */
  async findAll(params?: {
    skip?: number;
    take?: number;
  }): Promise<{ items: CouponEntity[]; total: number }> {
    const query = this.buildPaginationQuery(params);
    const [items, total] = await Promise.all([
      this.db.coupon.findMany({ orderBy: { createdAt: "desc" }, ...query }),
      this.db.coupon.count(),
    ]);

    return { items: items.map((item) => CouponMapper.toDomain(item)), total };
  }

  /**
   * Find coupon by id.
   */
  async findById(id: string): Promise<CouponEntity | null> {
    const coupon = await this.db.coupon.findUnique({ where: { id } });
    return coupon ? CouponMapper.toDomain(coupon) : null;
  }

  /**
   * Find coupon by code.
   */
  async findByCode(code: string): Promise<CouponEntity | null> {
    const coupon = await this.db.coupon.findFirst({ where: { code } });
    return coupon ? CouponMapper.toDomain(coupon) : null;
  }

  /**
   * Create a new coupon.
   */
  async create(data: CreateCouponInput): Promise<CouponEntity> {
    const coupon = await this.db.coupon.create({
      data: {
        id: randomUUID(),
        ...data,
        updatedAt: new Date(),
      },
    });

    return CouponMapper.toDomain(coupon);
  }

  /**
   * Increment coupon usage count.
   */
  async incrementUsage(id: string, tx?: unknown): Promise<CouponEntity> {
    const couponDelegate = this.getCouponDelegate(tx);
    const coupon = await couponDelegate.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });

    return CouponMapper.toDomain(coupon);
  }

  /**
   * Record coupon usage history.
   */
  async recordUsage(
    couponId: string,
    pelangganId: string,
    tx?: unknown,
  ): Promise<CouponUsageEntity> {
    const usageDelegate = this.getCouponUsageDelegate(tx);
    const usage = await usageDelegate.create({
      data: {
        id: randomUUID(),
        couponId,
        pelangganId,
        usedAt: new Date(),
      },
      include: {
        pelanggan: {
          select: { nama: true },
        },
      },
    });

    return CouponMapper.toUsageDomain(usage);
  }

  /**
   * Delete coupon by id.
   */
  async delete(id: string): Promise<void> {
    await this.db.coupon.delete({ where: { id } });
  }

  /**
   * Build pagination query.
   */
  private buildPaginationQuery(params?: { skip?: number; take?: number }) {
    if (!params) {
      return {};
    }

    const query: { skip?: number; take?: number } = {};
    if (params.skip !== undefined) {
      query.skip = params.skip;
    }
    if (params.take !== undefined) {
      query.take = params.take;
    }
    return query;
  }

  /**
   * Get coupon delegate from transaction or prisma client.
   */
  private getCouponDelegate(tx?: unknown) {
    const database = tx ?? this.db;
    return (database as unknown as { coupon: Prisma.CouponDelegate<undefined> })
      .coupon;
  }

  /**
   * Get coupon usage delegate from transaction or prisma client.
   */
  private getCouponUsageDelegate(tx?: unknown) {
    const database = tx ?? this.db;
    return (
      database as unknown as {
        couponUsage: Prisma.CouponUsageDelegate<undefined>;
      }
    ).couponUsage;
  }
}
