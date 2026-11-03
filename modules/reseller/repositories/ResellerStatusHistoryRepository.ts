import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

import type { ResellerStatusHistoryEntity } from "../domain/entities/ResellerEntity";
import type { IResellerStatusHistoryRepository } from "../domain/ports/IResellerStatusHistoryRepository";

/** Baca riwayat status kemitraan reseller dalam scope tenant. */
export class ResellerStatusHistoryRepository implements IResellerStatusHistoryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Riwayat satu reseller, terbaru lebih dulu. */
  async findByResellerId(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly skip: number;
    readonly take: number;
  }): Promise<{
    readonly items: readonly ResellerStatusHistoryEntity[];
    readonly total: number;
  }> {
    const where = { tenantId: params.tenantId, resellerId: params.resellerId };
    const [items, total] = await Promise.all([
      this.db.resellerStatusHistory.findMany({
        where,
        orderBy: [{ changedAt: "desc" }, { id: "desc" }],
        skip: params.skip,
        take: params.take,
      }),
      this.db.resellerStatusHistory.count({ where }),
    ]);
    return { items, total };
  }
}
