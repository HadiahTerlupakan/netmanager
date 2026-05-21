import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getJournalPostingService } from "@/modules/accounting";
import { CoaNotFoundError } from "@/modules/accounting";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";

const SOURCE = "BhpUsoService";

interface CalculateMonthlyResult {
  bhpAmount: number;
  usoAmount: number;
  revenue: number;
}

interface CalculateAllResult {
  period: string;
  tenantsProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    tenantId: string;
    revenue: number;
    bhpAmount: number;
    usoAmount: number;
    error?: string;
  }>;
}

/**
 * Resolves a COA id by code for a given tenant.
 * Returns null if not found.
 */
async function resolveCoaId(
  tenantId: string,
  code: string,
): Promise<string | null> {
  const coa = await prisma.chartOfAccount.findUnique({
    where: { tenantId_code: { tenantId, code } },
    select: { id: true },
  });
  return coa?.id ?? null;
}

/**
 * Service untuk menghitung dan mencatat BHP (Biaya Hak Penyelenggaraan)
 * dan USO (Universal Service Obligation) berdasarkan total revenue bulanan.
 *
 * BHP = revenue * bhpRate / 100
 * USO = revenue * usoRate / 100
 */
export class BhpUsoService {
  constructor(
    private readonly configRepo: ITaxConfigRepository,
    private readonly txnRepo: ITaxTransactionRepository,
  ) {}

  /**
   * Calculate BHP/USO for all tenants for the previous month.
   * Used by cron job.
   */
  async calculateAllForPreviousMonth(): Promise<CalculateAllResult> {
    const now = new Date();
    let prevMonth = now.getMonth(); // 0-indexed = current month - 1
    let prevYear = now.getFullYear();
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }

    const tenantIds = await this.configRepo.findAllTenantIds();
    const period = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    const results: CalculateAllResult["results"] = [];

    for (const tenantId of tenantIds) {
      try {
        const result = await this.calculateMonthly(
          tenantId,
          prevYear,
          prevMonth,
        );
        results.push({ tenantId, ...result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(`[${SOURCE}] Error for tenant ${tenantId}: ${message}`);
        results.push({
          tenantId,
          revenue: 0,
          bhpAmount: 0,
          usoAmount: 0,
          error: message,
        });
      }
    }

    return {
      period,
      tenantsProcessed: tenantIds.length,
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      results,
    };
  }

  /**
   * Hitung BHP dan USO untuk bulan tertentu berdasarkan total revenue.
   * Revenue diambil dari journal lines akun tipe REVENUE yang POSTED dalam periode tersebut.
   * Idempotent: skip jika sudah ada TaxTransaction untuk periode ini.
   */
  async calculateMonthly(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<CalculateMonthlyResult> {
    // 1. Get TaxConfig
    const config = await this.configRepo.findByTenantId(tenantId);
    if (!config) {
      logger.debug(
        `[${SOURCE}] No TaxConfig for tenant ${tenantId}, skip BHP/USO`,
      );
      return { bhpAmount: 0, usoAmount: 0, revenue: 0 };
    }

    const bhpRate = Number(config.bhpRate);
    const usoRate = Number(config.usoRate);

    if (bhpRate === 0 && usoRate === 0) {
      logger.debug(
        `[${SOURCE}] BHP and USO rates are 0 for tenant ${tenantId}, skip`,
      );
      return { bhpAmount: 0, usoAmount: 0, revenue: 0 };
    }

    const periodRef = `${year}-${String(month).padStart(2, "0")}`;

    // 2. Idempotent check — if BHP already recorded for this period, skip
    const existingBhp = await this.txnRepo.findBySource(
      tenantId,
      "Period",
      periodRef,
      "BHP",
    );
    if (existingBhp) {
      logger.debug(
        `[${SOURCE}] BHP/USO already recorded for period ${periodRef}, tenant ${tenantId}`,
      );
      return {
        bhpAmount: existingBhp.taxAmount,
        usoAmount: 0, // Already processed
        revenue: existingBhp.amount,
      };
    }

    // 3. Query total revenue for the month
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59, 999);

    const revenueResult = await prisma.$queryRaw<[{ total: bigint | null }]>`
      SELECT COALESCE(SUM(jl.amount), 0) as total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${tenantId}
        AND je.status = 'POSTED'
        AND coa.type = 'REVENUE'
        AND jl.side = 'CREDIT'
        AND je."entryDate" >= ${firstDay}
        AND je."entryDate" <= ${lastDay}
    `;

    const revenue = Number(revenueResult[0]?.total ?? 0);

    if (revenue === 0) {
      logger.debug(
        `[${SOURCE}] No revenue for period ${periodRef}, tenant ${tenantId}`,
      );
      return { bhpAmount: 0, usoAmount: 0, revenue: 0 };
    }

    // 4. Calculate amounts
    const bhpAmount = Math.round(((revenue * bhpRate) / 100) * 100) / 100;
    const usoAmount = Math.round(((revenue * usoRate) / 100) * 100) / 100;

    const entryDate = lastDay;

    // 5. Post BHP journal if amount > 0
    if (bhpAmount > 0) {
      await this.postBhpJournal(
        tenantId,
        bhpAmount,
        revenue,
        bhpRate,
        periodRef,
        entryDate,
      );
    }

    // 6. Post USO journal if amount > 0
    if (usoAmount > 0) {
      await this.postUsoJournal(
        tenantId,
        usoAmount,
        revenue,
        usoRate,
        periodRef,
        entryDate,
      );
    }

    logger.info(
      `[${SOURCE}] BHP/USO calculated for ${periodRef}, tenant ${tenantId}: ` +
        `revenue=${revenue}, BHP=${bhpAmount}, USO=${usoAmount}`,
    );

    return { bhpAmount, usoAmount, revenue };
  }

  /** Post BHP journal: DR Beban BHP (5-710) / CR Hutang BHP (2-500) */
  private async postBhpJournal(
    tenantId: string,
    bhpAmount: number,
    revenue: number,
    bhpRate: number,
    periodRef: string,
    entryDate: Date,
  ): Promise<void> {
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "5-710"), // Beban BHP
      resolveCoaId(tenantId, "2-500"), // Hutang BHP
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "5-710" : "2-500");
    }

    const postingService = getJournalPostingService();
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_BHP",
      sourceRefType: "Period",
      sourceRefId: periodRef,
      entryDate,
      description: `BHP ${bhpRate}% — Periode ${periodRef}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(bhpAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(bhpAmount) },
      ],
    });

    await this.txnRepo.create({
      tenantId,
      taxType: "BHP",
      direction: "OUT",
      amount: revenue,
      taxAmount: bhpAmount,
      rate: bhpRate,
      sourceRefType: "Period",
      sourceRefId: periodRef,
      periodYear: entryDate.getFullYear(),
      periodMonth: entryDate.getMonth() + 1,
      journalId: journal.id,
      notes: `BHP ${bhpRate}% dari revenue ${periodRef}: Rp ${revenue.toLocaleString("id-ID")}`,
    });
  }

  /** Post USO journal: DR Beban USO (5-720) / CR Hutang USO (2-510) */
  private async postUsoJournal(
    tenantId: string,
    usoAmount: number,
    revenue: number,
    usoRate: number,
    periodRef: string,
    entryDate: Date,
  ): Promise<void> {
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "5-720"), // Beban USO
      resolveCoaId(tenantId, "2-510"), // Hutang USO
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "5-720" : "2-510");
    }

    const postingService = getJournalPostingService();
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_USO",
      sourceRefType: "Period",
      sourceRefId: periodRef,
      entryDate,
      description: `USO ${usoRate}% — Periode ${periodRef}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(usoAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(usoAmount) },
      ],
    });

    await this.txnRepo.create({
      tenantId,
      taxType: "USO",
      direction: "OUT",
      amount: revenue,
      taxAmount: usoAmount,
      rate: usoRate,
      sourceRefType: "Period",
      sourceRefId: periodRef,
      periodYear: entryDate.getFullYear(),
      periodMonth: entryDate.getMonth() + 1,
      journalId: journal.id,
      notes: `USO ${usoRate}% dari revenue ${periodRef}: Rp ${revenue.toLocaleString("id-ID")}`,
    });
  }
}
