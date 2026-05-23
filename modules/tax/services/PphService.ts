import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  getJournalPostingService,
  getPeriodService,
} from "@/modules/accounting";
import { CoaNotFoundError } from "@/modules/accounting";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";

const SOURCE = "PphService";

interface RecordPph21Params {
  tenantId: string;
  salaryId: string;
  grossSalary: number;
  pph21Amount: number;
  processedDate: Date;
}

interface RecordPph23Params {
  tenantId: string;
  expenseId: string;
  amount: number;
  category: "jasa" | "sewa";
  expenseDate: Date;
  customRate?: number;
  sourceRefType?: string;
}

interface RecordPph4Params {
  tenantId: string;
  expenseId: string;
  amount: number;
  expenseDate: Date;
  customRate?: number;
  sourceRefType?: string;
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
 * Service for recording PPh (Pajak Penghasilan) transactions.
 * Handles PPh 21 (salary), PPh 23 (jasa/sewa), and PPh 4(2) (sewa tanah/bangunan).
 */
export class PphService {
  constructor(
    private readonly configRepo: ITaxConfigRepository,
    private readonly txnRepo: ITaxTransactionRepository,
  ) {}

  /**
   * Record PPh 21 from salary — amount already calculated by salary module.
   * Journal: DR Beban Gaji (5-100) / CR Hutang PPh 21 (2-400)
   */
  async recordPph21(params: RecordPph21Params): Promise<TaxTransaction | null> {
    const { tenantId, salaryId, grossSalary, pph21Amount, processedDate } =
      params;

    if (pph21Amount <= 0) {
      logger.debug(
        `[${SOURCE}] PPh 21 amount is 0 for salary ${salaryId}, skip`,
      );
      return null;
    }

    // 1. Idempotent check
    const existing = await this.txnRepo.findBySource(
      tenantId,
      "Salary",
      salaryId,
      "PPH_21",
    );
    if (existing) {
      logger.debug(
        `[${SOURCE}] PPh 21 already recorded for salary ${salaryId}`,
      );
      return existing;
    }

    // 2. Create TaxTransaction record only.
    // Journal posting is handled by the accounting module's salary-processed handler
    // to avoid double-debit on Beban Gaji.
    const periodYear = processedDate.getFullYear();
    const periodMonth = processedDate.getMonth() + 1;

    const txn = await this.txnRepo.create({
      tenantId,
      taxType: "PPH_21",
      direction: "OUT",
      amount: grossSalary,
      taxAmount: pph21Amount,
      rate: grossSalary > 0 ? (pph21Amount / grossSalary) * 100 : 0,
      sourceRefType: "Salary",
      sourceRefId: salaryId,
      periodYear,
      periodMonth,
      journalId: null,
      notes: `PPh 21 dari Salary ${salaryId}`,
    });

    logger.info(
      `[${SOURCE}] PPh 21 recorded: ${pph21Amount} for salary ${salaryId}`,
    );
    return txn;
  }

  /**
   * Record PPh 23 from expense jasa (2%) or sewa non-tanah (2%).
   * Journal: DR Beban Operasional Lainnya (5-500) / CR Hutang PPh 23 (2-410)
   */
  async recordPph23(params: RecordPph23Params): Promise<TaxTransaction | null> {
    const { tenantId, expenseId, amount, category, expenseDate } = params;

    // 1. Idempotent check
    const existing = await this.txnRepo.findBySource(
      tenantId,
      "Expense",
      expenseId,
      "PPH_23",
    );
    if (existing) {
      logger.debug(
        `[${SOURCE}] PPh 23 already recorded for expense ${expenseId}`,
      );
      return existing;
    }

    // 2. Get rate from config
    const config = await this.configRepo.findByTenantId(tenantId);
    const rate =
      params.customRate ??
      (category === "jasa"
        ? Number(config?.pph23RateJasa ?? 2)
        : Number(config?.pph23RateSewa ?? 2));

    // 3. Calculate tax amount
    const taxAmount = Math.round(((amount * rate) / 100) * 100) / 100;
    if (taxAmount <= 0) {
      logger.debug(
        `[${SOURCE}] PPh 23 tax amount is 0 for expense ${expenseId}, skip`,
      );
      return null;
    }

    // 4. Ensure period is open
    const periodService = getPeriodService();
    await periodService.ensureCurrentPeriod(tenantId, expenseDate);

    // 5. Resolve COA
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "5-500"), // Beban Operasional Lainnya
      resolveCoaId(tenantId, "2-410"), // Hutang PPh 23
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "5-500" : "2-410");
    }

    // 6. Post journal
    const postingService = getJournalPostingService();
    const refType = params.sourceRefType || "Expense";
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_PPH_23",
      sourceRefType: refType,
      sourceRefId: expenseId,
      entryDate: expenseDate,
      description: `PPh 23 (${category}) ${rate}% — ${refType} ${expenseId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(taxAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(taxAmount) },
      ],
    });

    // 7. Create TaxTransaction record
    const periodYear = expenseDate.getFullYear();
    const periodMonth = expenseDate.getMonth() + 1;

    const txn = await this.txnRepo.create({
      tenantId,
      taxType: "PPH_23",
      direction: "OUT",
      amount,
      taxAmount,
      rate,
      sourceRefType: refType,
      sourceRefId: expenseId,
      periodYear,
      periodMonth,
      journalId: journal.id,
      notes: `PPh 23 (${category}) ${rate}% dari ${refType} ${expenseId}`,
    });

    logger.info(
      `[${SOURCE}] PPh 23 recorded: ${taxAmount} for expense ${expenseId}`,
    );
    return txn;
  }

  /**
   * Record PPh 4(2) from expense sewa tanah/bangunan (10% final).
   * Journal: DR Beban Sewa (5-300) / CR Hutang PPh 4(2) (2-420)
   */
  async recordPph4(params: RecordPph4Params): Promise<TaxTransaction | null> {
    const { tenantId, expenseId, amount, expenseDate } = params;

    // 1. Idempotent check
    const existing = await this.txnRepo.findBySource(
      tenantId,
      "Expense",
      expenseId,
      "PPH_4_2",
    );
    if (existing) {
      logger.debug(
        `[${SOURCE}] PPh 4(2) already recorded for expense ${expenseId}`,
      );
      return existing;
    }

    // 2. Get rate from config
    const config = await this.configRepo.findByTenantId(tenantId);
    const rate = params.customRate ?? Number(config?.pph4Rate ?? 10);

    // 3. Calculate tax amount
    const taxAmount = Math.round(((amount * rate) / 100) * 100) / 100;
    if (taxAmount <= 0) {
      logger.debug(
        `[${SOURCE}] PPh 4(2) tax amount is 0 for expense ${expenseId}, skip`,
      );
      return null;
    }

    // 4. Ensure period is open
    const periodService = getPeriodService();
    await periodService.ensureCurrentPeriod(tenantId, expenseDate);

    // 5. Resolve COA
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "5-300"), // Beban Sewa
      resolveCoaId(tenantId, "2-420"), // Hutang PPh 4(2)
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "5-300" : "2-420");
    }

    // 6. Post journal
    const postingService = getJournalPostingService();
    const refType = params.sourceRefType || "Expense";
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_PPH_4_2",
      sourceRefType: refType,
      sourceRefId: expenseId,
      entryDate: expenseDate,
      description: `PPh 4(2) ${rate}% — ${refType} ${expenseId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(taxAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(taxAmount) },
      ],
    });

    // 7. Create TaxTransaction record
    const periodYear = expenseDate.getFullYear();
    const periodMonth = expenseDate.getMonth() + 1;

    const txn = await this.txnRepo.create({
      tenantId,
      taxType: "PPH_4_2",
      direction: "OUT",
      amount,
      taxAmount,
      rate,
      sourceRefType: refType,
      sourceRefId: expenseId,
      periodYear,
      periodMonth,
      journalId: journal.id,
      notes: `PPh 4(2) ${rate}% dari ${refType} ${expenseId}`,
    });

    logger.info(
      `[${SOURCE}] PPh 4(2) recorded: ${taxAmount} for expense ${expenseId}`,
    );
    return txn;
  }
}
