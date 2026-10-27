import { PrismaClient, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import type { CreateCouponInput, UpdateCouponInput } from "../dto/CouponDTO";
import type {
  CouponEntity,
  CouponUsageEntity,
} from "../domain/entities/CouponEntity";
import type { ICouponRepository } from "../domain/ports/ICouponRepository";
import { CouponMapper } from "../mappers/CouponMapper";

export class CouponRepository implements ICouponRepository {
  private readonly db: PrismaClient;

  constructor(database: PrismaClient = prisma) {
    this.db = database;
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    tenantId?: string | null;
  }): Promise<{ items: CouponEntity[]; total: number }> {
    const where = this.buildTenantFilter(params?.tenantId);
    const query = this.buildPaginationQuery(params);
    const [items, total] = await Promise.all([
      this.db.coupon.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...query,
      }),
      this.db.coupon.count({ where }),
    ]);

    return { items: items.map((item) => CouponMapper.toDomain(item)), total };
  }

  async findById(id: string): Promise<CouponEntity | null> {
    const coupon = await this.db.coupon.findUnique({ where: { id } });
    return coupon ? CouponMapper.toDomain(coupon) : null;
  }

  async findByCode(
    code: string,
    tenantId?: string | null,
  ): Promise<CouponEntity | null> {
    const where: Record<string, unknown> = { code };
    if (tenantId) {
      where.tenantId = tenantId;
    }
    const coupon = await this.db.coupon.findFirst({ where });
    return coupon ? CouponMapper.toDomain(coupon) : null;
  }

  async create(
    data: CreateCouponInput & { tenantId?: string | null },
  ): Promise<CouponEntity> {
    const coupon = await this.db.coupon.create({
      data: {
        id: randomUUID(),
        ...data,
        tenantId: data.tenantId ?? null,
        updatedAt: new Date(),
      },
    });

    return CouponMapper.toDomain(coupon);
  }

  async update(id: string, data: UpdateCouponInput): Promise<CouponEntity> {
    const coupon = await this.db.coupon.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return CouponMapper.toDomain(coupon);
  }

  async incrementUsage(id: string, tx?: unknown): Promise<CouponEntity> {
    const couponDelegate = this.getCouponDelegate(tx);
    const coupon = await couponDelegate.update({
      where: { id },
      data: { usedCount: { increment: 1 } },
    });

    return CouponMapper.toDomain(coupon);
  }

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

  async reserveUsage(
    couponId: string,
    pelangganId: string,
  ): Promise<string | null> {
    return this.db.$transaction(async (tx) => {
      // Cek kuota dan kenaikan usedCount dalam satu UPDATE, jadi dua
      // permintaan bersamaan tidak bisa sama-sama lolos dari kuota terakhir.
      const reserved = await tx.coupon.updateMany({
        where: {
          id: couponId,
          isActive: true,
          OR: [
            { quota: 0 },
            { usedCount: { lt: this.db.coupon.fields.quota } },
          ],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (reserved.count === 0) {
        return null;
      }

      const usage = await this.recordUsage(couponId, pelangganId, tx);
      return usage.id;
    });
  }

  async restoreUsage(couponId: string, pelangganId: string): Promise<string> {
    return this.db.$transaction(async (tx) => {
      await this.incrementUsage(couponId, tx);
      const usage = await this.recordUsage(couponId, pelangganId, tx);
      return usage.id;
    });
  }

  async releaseUsage(usageId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const usage = await tx.couponUsage.findUnique({
        where: { id: usageId },
        select: { couponId: true },
      });
      if (!usage) return;

      // Kuota hanya dikembalikan oleh pemanggil yang benar-benar menghapus
      // riwayatnya, jadi webhook ganda tidak mengembalikannya dua kali.
      const deleted = await tx.couponUsage.deleteMany({
        where: { id: usageId },
      });
      if (deleted.count === 0) return;

      await tx.coupon.updateMany({
        where: { id: usage.couponId, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.coupon.delete({ where: { id } });
  }

  private buildTenantFilter(tenantId?: string | null) {
    if (!tenantId) return {};
    return { tenantId };
  }

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

  private getCouponDelegate(tx?: unknown) {
    const database = tx ?? this.db;
    return (database as unknown as { coupon: Prisma.CouponDelegate<undefined> })
      .coupon;
  }

  private getCouponUsageDelegate(tx?: unknown) {
    const database = tx ?? this.db;
    return (
      database as unknown as {
        couponUsage: Prisma.CouponUsageDelegate<undefined>;
      }
    ).couponUsage;
  }
}
