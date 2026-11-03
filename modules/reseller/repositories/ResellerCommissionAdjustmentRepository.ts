import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ResellerCommissionAdjustmentEntity } from "../domain/entities/ResellerCommissionEntity";
import type {
  AdjustmentListParams,
  IResellerCommissionAdjustmentRepository,
} from "../domain/ports/IResellerCommissionAdjustmentRepository";
import {
  ADJUSTMENT_WITH_APPLICATIONS,
  toAdjustmentEntity,
} from "./commission-adjustment-tx";

export class ResellerCommissionAdjustmentRepository implements IResellerCommissionAdjustmentRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Koreksi reseller di tenant, terbaru dulu, beserta sisanya. */
  async findAdjustments(params: AdjustmentListParams): Promise<{
    readonly items: readonly ResellerCommissionAdjustmentEntity[];
    readonly total: number;
  }> {
    const where: Prisma.ResellerCommissionAdjustmentWhereInput = {
      tenantId: params.tenantId,
      resellerId: params.resellerId,
    };
    const [rows, total] = await Promise.all([
      this.db.resellerCommissionAdjustment.findMany({
        where,
        include: ADJUSTMENT_WITH_APPLICATIONS,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: params.skip,
        take: params.take,
      }),
      this.db.resellerCommissionAdjustment.count({ where }),
    ]);
    return { items: rows.map(toAdjustmentEntity), total };
  }
}
