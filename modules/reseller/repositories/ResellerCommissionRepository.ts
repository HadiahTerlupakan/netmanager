import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateCommissionData,
  CreateSettlementData,
  IResellerCommissionRepository,
  CommissionListParams,
  SettlementListParams,
} from "../domain/ports/IResellerCommissionRepository";
import type {
  ResellerCommissionEntity,
  ResellerCommissionRuleEntity,
  ResellerCommissionSummaryEntity,
  ResellerCustomerCommissionContext,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";

const ACTIVE_STATUS = "ACTIVE";
const ACCRUED_STATUS = "ACCRUED";
const SETTLED_STATUS = "SETTLED";
const PAID_STATUS = "PAID";

export class ResellerCommissionRepository implements IResellerCommissionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Find customer reseller context for commission accrual. */
  async findCustomerContext(
    tenantId: string | null,
    pelangganId: string,
  ): Promise<ResellerCustomerCommissionContext | null> {
    const pelanggan = await this.db.pelanggan.findFirst({
      where: { id: pelangganId, tenantId },
      select: {
        id: true,
        tenantId: true,
        resellerId: true,
        hargaPaketId: true,
      },
    });
    if (!pelanggan) return null;
    return {
      tenantId: pelanggan.tenantId,
      pelangganId: pelanggan.id,
      resellerId: pelanggan.resellerId,
      hargaPaketId: pelanggan.hargaPaketId,
    };
  }

  /** Resolve active commission rule for reseller and package. */
  async findActiveCommissionRule(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly hargaPaketId: string | null;
    readonly at: Date;
  }): Promise<ResellerCommissionRuleEntity | null> {
    const packageRule = params.hargaPaketId
      ? await this.db.resellerCommissionRule.findFirst({
          where: this.ruleWhere(params, params.hargaPaketId),
          orderBy: { startsAt: "desc" },
        })
      : null;
    if (packageRule) return packageRule;
    return this.db.resellerCommissionRule.findFirst({
      where: this.ruleWhere(params, null),
      orderBy: { startsAt: "desc" },
    });
  }

  /** Find commission by invoice id for idempotency. */
  async findCommissionByInvoiceId(
    tenantId: string | null,
    invoiceId: string,
  ): Promise<ResellerCommissionEntity | null> {
    return this.db.resellerCommission.findFirst({
      where: { tenantId, invoiceId, deletedAt: null },
    });
  }

  /** Create accrued commission. */
  async createCommission(
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity> {
    return this.db.resellerCommission.create({
      data: {
        id: randomUUID(),
        tenantId: data.tenantId,
        resellerId: data.resellerId,
        pelangganId: data.pelangganId,
        invoiceId: data.invoiceId,
        paymentId: data.paymentId,
        commissionRuleId: data.commissionRuleId,
        type: data.type,
        rate: data.rate,
        baseAmount: data.baseAmount,
        commissionAmount: data.commissionAmount,
        period: data.period,
        accruedAt: data.accruedAt,
      },
    });
  }

  /** List commissions for reseller. */
  async findCommissions(params: CommissionListParams): Promise<{
    readonly items: readonly ResellerCommissionEntity[];
    readonly total: number;
  }> {
    const where: Prisma.ResellerCommissionWhereInput = {
      tenantId: params.tenantId,
      resellerId: params.resellerId,
      deletedAt: null,
      ...(params.period ? { period: params.period } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.resellerCommission.findMany({
        where,
        orderBy: { accruedAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      this.db.resellerCommission.count({ where }),
    ]);
    return { items, total };
  }

  /** Create settlement and attach accrued commissions in one transaction. */
  async createSettlement(
    data: CreateSettlementData,
  ): Promise<ResellerSettlementEntity> {
    return this.db.$transaction(async (tx) => {
      const commissions = await tx.resellerCommission.findMany({
        where: {
          tenantId: data.tenantId,
          resellerId: data.resellerId,
          status: ACCRUED_STATUS,
          deletedAt: null,
          accruedAt: { gte: data.periodStart, lte: data.periodEnd },
        },
        select: { id: true, commissionAmount: true },
      });
      if (commissions.length === 0) {
        throw new Error("Tidak ada komisi reseller yang dapat disettle");
      }
      const totalAmount = commissions.reduce(
        (total, commission) => total + commission.commissionAmount,
        0,
      );
      const settlement = await tx.resellerSettlement.create({
        data: {
          id: randomUUID(),
          tenantId: data.tenantId,
          resellerId: data.resellerId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          totalAmount,
          commissionCount: commissions.length,
          notes: data.notes,
        },
      });
      await tx.resellerCommission.updateMany({
        where: { id: { in: commissions.map((commission) => commission.id) } },
        data: {
          status: SETTLED_STATUS,
          settlementId: settlement.id,
          settledAt: new Date(),
        },
      });
      return settlement;
    });
  }

  /** List settlements. */
  async findSettlements(params: SettlementListParams): Promise<{
    readonly items: readonly ResellerSettlementEntity[];
    readonly total: number;
  }> {
    const where: Prisma.ResellerSettlementWhereInput = {
      tenantId: params.tenantId,
      deletedAt: null,
      ...(params.resellerId ? { resellerId: params.resellerId } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.resellerSettlement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: params.skip,
        take: params.take,
      }),
      this.db.resellerSettlement.count({ where }),
    ]);
    return { items, total };
  }

  /** Get commission totals for reporting. */
  async getCommissionSummary(params: {
    readonly tenantId: string | null;
    readonly resellerId: string;
    readonly periodStart: Date;
    readonly periodEnd: Date;
  }): Promise<ResellerCommissionSummaryEntity> {
    const rows = await this.db.resellerCommission.groupBy({
      by: ["status"],
      where: {
        tenantId: params.tenantId,
        resellerId: params.resellerId,
        deletedAt: null,
        accruedAt: { gte: params.periodStart, lte: params.periodEnd },
      },
      _sum: { commissionAmount: true },
      _count: { _all: true },
    });
    return rows.reduce<ResellerCommissionSummaryEntity>(
      (summary, row) => ({
        accruedAmount:
          row.status === ACCRUED_STATUS
            ? (row._sum.commissionAmount ?? 0)
            : summary.accruedAmount,
        settledAmount:
          row.status === SETTLED_STATUS
            ? (row._sum.commissionAmount ?? 0)
            : summary.settledAmount,
        paidAmount:
          row.status === PAID_STATUS
            ? (row._sum.commissionAmount ?? 0)
            : summary.paidAmount,
        commissionCount: summary.commissionCount + row._count._all,
      }),
      { accruedAmount: 0, settledAmount: 0, paidAmount: 0, commissionCount: 0 },
    );
  }

  private ruleWhere(
    params: {
      readonly tenantId: string | null;
      readonly resellerId: string;
      readonly at: Date;
    },
    hargaPaketId: string | null,
  ): Prisma.ResellerCommissionRuleWhereInput {
    return {
      tenantId: params.tenantId,
      resellerId: params.resellerId,
      hargaPaketId,
      status: ACTIVE_STATUS,
      deletedAt: null,
      startsAt: { lte: params.at },
      OR: [{ endsAt: null }, { endsAt: { gte: params.at } }],
    };
  }
}
