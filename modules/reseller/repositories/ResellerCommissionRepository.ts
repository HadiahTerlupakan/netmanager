import { randomUUID } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isPrismaUniqueConstraintError } from "@/lib/prisma-errors";
import type {
  CreateCommissionData,
  CreateSettlementData,
  IResellerCommissionRepository,
  CommissionListParams,
  SettlementListParams,
  SettlementOutcome,
} from "../domain/ports/IResellerCommissionRepository";
import type {
  ResellerCommissionEntity,
  ResellerCommissionRuleEntity,
  ResellerCommissionSummaryEntity,
  ResellerCustomerCommissionContext,
  ResellerSettlementEntity,
} from "../domain/entities/ResellerCommissionEntity";
import { withNumericRate } from "./commission-rate-mapper";
import {
  planAdjustmentDeduction,
  recordAdjustmentApplications,
} from "./commission-adjustment-tx";
import {
  lockInvoiceCommission,
  lockResellerAdjustments,
} from "./commission-locks";

const ACTIVE_STATUS = "ACTIVE";
const ACCRUED_STATUS = "ACCRUED";
const SETTLED_STATUS = "SETTLED";
const PAID_STATUS = "PAID";
const REVERSED_STATUS = "REVERSED";

/** Dilempar di dalam transaksi settlement agar Prisma me-rollback-nya. */
class SettlementClaimConflict extends Error {
  constructor() {
    super("Komisi reseller sudah diambil settlement lain");
  }
}

export class ResellerCommissionRepository implements IResellerCommissionRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  /** Find customer reseller context for commission accrual. */
  async findCustomerContext(
    tenantId: string | null,
    pelangganId: string,
  ): Promise<ResellerCustomerCommissionContext | null> {
    const pelanggan = await this.db.pelanggan.findFirst({
      where: { id: pelangganId, ...(tenantId ? { tenantId } : {}) },
      select: {
        id: true,
        tenantId: true,
        resellerId: true,
        hargaPaketId: true,
        reseller: { select: { status: true, statusChangedAt: true } },
      },
    });
    if (!pelanggan) return null;
    return {
      tenantId: pelanggan.tenantId,
      pelangganId: pelanggan.id,
      resellerId: pelanggan.resellerId,
      resellerStatus: pelanggan.reseller?.status ?? null,
      resellerStatusChangedAt: pelanggan.reseller?.statusChangedAt ?? null,
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
    const rule =
      packageRule ??
      (await this.db.resellerCommissionRule.findFirst({
        where: this.ruleWhere(params, null),
        orderBy: { startsAt: "desc" },
      }));
    return rule ? withNumericRate(rule) : null;
  }

  /**
   * Find commission by invoice id for idempotency. Baris yang sudah
   * di-soft-delete ikut dihitung: unique (tenantId, invoiceId) mencakupnya,
   * dan komisi yang dibatalkan (invoice di-void) tidak boleh terbit lagi.
   */
  async findCommissionByInvoiceId(
    tenantId: string | null,
    invoiceId: string,
  ): Promise<ResellerCommissionEntity | null> {
    const commission = await this.db.resellerCommission.findFirst({
      where: { tenantId, invoiceId },
    });
    return commission ? withNumericRate(commission) : null;
  }

  /**
   * Create accrued commission. Dua job INVOICE_PAID yang berlomba sama-sama
   * lolos cek idempotensi; yang kalah mendapat P2002 dan dianggap selesai.
   */
  async createCommission(
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity | null> {
    try {
      return await this.insertCommissionOnce(data);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) return null;
      throw error;
    }
  }

  /** Pulihkan komisi ACCRUED yang dibatalkan dan belum disettle. */
  async restoreCancelledCommission(params: {
    readonly commissionId: string;
    readonly accruedAt: Date;
    readonly period: string;
  }): Promise<ResellerCommissionEntity | null> {
    const restored = await this.db.resellerCommission.updateMany({
      where: {
        id: params.commissionId,
        status: ACCRUED_STATUS,
        settlementId: null,
        deletedAt: { not: null },
      },
      data: {
        deletedAt: null,
        accruedAt: params.accruedAt,
        period: params.period,
      },
    });
    if (restored.count === 0) return null;
    const commission = await this.db.resellerCommission.findFirst({
      where: { id: params.commissionId },
    });
    return commission ? withNumericRate(commission) : null;
  }

  /**
   * REVERSED → ACCRUED dengan akrual baru, di bawah kunci invoice yang sama
   * dengan pembalikan. Tautan ke settlement lama yang sudah dibayar dilepas;
   * jejak pembayarannya tetap ada di settlement itu dan di koreksinya.
   */
  async reaccrueReversedCommission(params: {
    readonly commissionId: string;
    readonly invoiceId: string;
    readonly accruedAt: Date;
    readonly period: string;
  }): Promise<ResellerCommissionEntity | null> {
    return this.db.$transaction(async (tx) => {
      await lockInvoiceCommission(tx, params.invoiceId);
      const reaccrued = await tx.resellerCommission.updateMany({
        where: {
          id: params.commissionId,
          status: REVERSED_STATUS,
          deletedAt: null,
        },
        data: {
          status: ACCRUED_STATUS,
          settlementId: null,
          settledAt: null,
          paidAt: null,
          accruedAt: params.accruedAt,
          period: params.period,
        },
      });
      if (reaccrued.count === 0) return null;
      const commission = await tx.resellerCommission.findFirst({
        where: { id: params.commissionId },
      });
      return commission ? withNumericRate(commission) : null;
    });
  }

  /** Cek reseller ada (belum dihapus) di tenant. */
  async resellerExists(
    tenantId: string | null,
    resellerId: string,
  ): Promise<boolean> {
    const reseller = await this.db.reseller.findFirst({
      where: { id: resellerId, tenantId, deletedAt: null },
      select: { id: true },
    });
    return reseller !== null;
  }

  /**
   * Unique (tenantId, invoiceId) tidak berlaku bila tenantId NULL (Postgres
   * menganggap NULL selalu berbeda), jadi dua job yang berlomba diserialkan
   * dengan advisory lock per invoice lalu mengecek ulang di dalamnya.
   */
  private async insertCommissionOnce(
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity | null> {
    return this.db.$transaction(async (tx) => {
      await lockInvoiceCommission(tx, data.invoiceId);
      const existing = await tx.resellerCommission.findFirst({
        where: { tenantId: data.tenantId, invoiceId: data.invoiceId },
        select: { id: true },
      });
      if (existing) return null;
      return this.insertCommission(tx, data);
    });
  }

  private async insertCommission(
    tx: Prisma.TransactionClient,
    data: CreateCommissionData,
  ): Promise<ResellerCommissionEntity> {
    const commission = await tx.resellerCommission.create({
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
    return withNumericRate(commission);
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
    return { items: items.map(withNumericRate), total };
  }

  /**
   * Create settlement and claim accrued commissions in one transaction.
   *
   * Klaim memakai `updateMany` bersyarat status ACCRUED dan settlementId null.
   * Di READ COMMITTED, transaksi kedua yang membaca baris yang sama tertahan
   * row lock transaksi pertama, lalu mengevaluasi ulang syaratnya setelah
   * commit dan tidak menemukan baris; jumlah yang tidak cocok me-rollback
   * settlement keduanya, jadi komisi tidak pernah disettle dua kali.
   *
   * Koreksi (clawback) terbuka reseller dipotongkan dari total, diserialkan
   * per reseller agar sisa koreksi yang sama tidak terpotong dua kali.
   */
  async createSettlement(
    data: CreateSettlementData,
  ): Promise<SettlementOutcome> {
    try {
      const settlement = await this.settleInTransaction(data);
      return settlement ? { kind: "settled", settlement } : { kind: "empty" };
    } catch (error) {
      if (error instanceof SettlementClaimConflict) return { kind: "conflict" };
      throw error;
    }
  }

  private async settleInTransaction(
    data: CreateSettlementData,
  ): Promise<ResellerSettlementEntity | null> {
    return this.db.$transaction(async (tx) => {
      await lockResellerAdjustments(tx, data.resellerId);
      const commissions = await tx.resellerCommission.findMany({
        where: {
          tenantId: data.tenantId,
          resellerId: data.resellerId,
          status: ACCRUED_STATUS,
          settlementId: null,
          deletedAt: null,
          accruedAt: { gte: data.periodStart, lte: data.periodEnd },
        },
        select: { id: true, commissionAmount: true },
      });
      if (commissions.length === 0) return null;
      const grossAmount = commissions.reduce(
        (total, commission) => total + commission.commissionAmount,
        0,
      );
      const deduction = await planAdjustmentDeduction(tx, data, grossAmount);
      const settlement = await tx.resellerSettlement.create({
        data: {
          id: randomUUID(),
          tenantId: data.tenantId,
          resellerId: data.resellerId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          totalAmount: grossAmount - deduction.deductedAmount,
          adjustmentAmount: deduction.deductedAmount,
          commissionCount: commissions.length,
          notes: data.notes,
          createdById: data.createdById ?? null,
        },
      });
      const claimed = await tx.resellerCommission.updateMany({
        where: {
          id: { in: commissions.map((commission) => commission.id) },
          status: ACCRUED_STATUS,
          settlementId: null,
          deletedAt: null,
        },
        data: {
          status: SETTLED_STATUS,
          settlementId: settlement.id,
          settledAt: new Date(),
        },
      });
      if (claimed.count !== commissions.length) {
        throw new SettlementClaimConflict();
      }
      await recordAdjustmentApplications(
        tx,
        { tenantId: data.tenantId, settlementId: settlement.id },
        deduction.allocations,
      );
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
        reversedAmount:
          row.status === REVERSED_STATUS
            ? (row._sum.commissionAmount ?? 0)
            : summary.reversedAmount,
        commissionCount: summary.commissionCount + row._count._all,
      }),
      {
        accruedAmount: 0,
        settledAmount: 0,
        paidAmount: 0,
        reversedAmount: 0,
        commissionCount: 0,
      },
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
