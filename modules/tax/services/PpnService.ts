import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getJournalPostingService } from "@/modules/accounting";
import { CoaNotFoundError } from "@/modules/accounting";
import type { ITaxConfigRepository } from "../domain/ports/ITaxConfigRepository";
import type { ITaxTransactionRepository } from "../domain/ports/ITaxTransactionRepository";
import type { TaxTransaction } from "../domain/entities/TaxTransaction";

const SOURCE = "PpnService";

interface RecordPpnKeluaranParams {
  tenantId: string;
  invoiceId: string;
  invoiceAmount: number;
  invoiceDate: Date;
}

interface RecordPpnMasukanParams {
  tenantId: string;
  expenseId: string;
  expenseAmount: number;
  expenseDate: Date;
}

/**
 * Resolves a COA id by code for a given tenant.
 * Returns null if not found (caller decides whether to throw or skip).
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

export class PpnService {
  constructor(
    private readonly configRepo: ITaxConfigRepository,
    private readonly txnRepo: ITaxTransactionRepository,
  ) {}

  /**
   * Record PPN Keluaran for an invoice.
   * Journal: DR Piutang Usaha (1-200) / CR Hutang PPN Keluaran (2-300)
   * Only records if tenant is PKP.
   */
  async recordPpnKeluaran(
    params: RecordPpnKeluaranParams,
  ): Promise<TaxTransaction | null> {
    const { tenantId, invoiceId, invoiceAmount, invoiceDate } = params;

    // 1. Get config, skip if not PKP
    const config = await this.configRepo.findByTenantId(tenantId);
    if (!config?.isPkp) {
      logger.debug(
        `[${SOURCE}] Tenant ${tenantId} bukan PKP, skip PPN Keluaran`,
      );
      return null;
    }

    // 2. Idempotent check
    const existing = await this.txnRepo.findBySource(
      tenantId,
      "Invoice",
      invoiceId,
      "PPN_KELUARAN",
    );
    if (existing) {
      logger.debug(
        `[${SOURCE}] PPN Keluaran already recorded for invoice ${invoiceId}`,
      );
      return existing;
    }

    // 3. Calculate tax amount
    const ppnRate = Number(config.ppnRate);
    let taxAmount: number;
    if (config.ppnIncluded) {
      // DPP = invoiceAmount / (1 + rate/100), PPN = DPP * rate/100
      const dpp = invoiceAmount / (1 + ppnRate / 100);
      taxAmount = dpp * (ppnRate / 100);
    } else {
      taxAmount = invoiceAmount * (ppnRate / 100);
    }
    taxAmount = Math.round(taxAmount * 100) / 100;

    // 4. Resolve COA
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "1-200"), // Piutang Usaha
      resolveCoaId(tenantId, "2-300"), // Hutang PPN Keluaran
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "1-200" : "2-300");
    }

    // 5. Post journal
    const postingService = getJournalPostingService();
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_PPN_KELUARAN",
      sourceRefType: "Invoice",
      sourceRefId: invoiceId,
      entryDate: invoiceDate,
      description: `PPN Keluaran ${ppnRate}% — Invoice ${invoiceId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(taxAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(taxAmount) },
      ],
    });

    // 6. Create TaxTransaction record
    const periodYear = invoiceDate.getFullYear();
    const periodMonth = invoiceDate.getMonth() + 1;

    const txn = await this.txnRepo.create({
      tenantId,
      taxType: "PPN_KELUARAN",
      direction: "OUT",
      amount: invoiceAmount,
      taxAmount,
      rate: ppnRate,
      sourceRefType: "Invoice",
      sourceRefId: invoiceId,
      periodYear,
      periodMonth,
      journalId: journal.id,
      notes: `PPN Keluaran ${ppnRate}% dari Invoice ${invoiceId}`,
    });

    logger.info(
      `[${SOURCE}] PPN Keluaran recorded: ${taxAmount} for invoice ${invoiceId}`,
    );
    return txn;
  }

  /**
   * Record PPN Masukan for an expense/purchase.
   * Journal: DR PPN Masukan (1-250) / CR Kas/Bank (1-120)
   * Only records if tenant is PKP.
   */
  async recordPpnMasukan(
    params: RecordPpnMasukanParams,
  ): Promise<TaxTransaction | null> {
    const { tenantId, expenseId, expenseAmount, expenseDate } = params;

    // 1. Get config, skip if not PKP
    const config = await this.configRepo.findByTenantId(tenantId);
    if (!config?.isPkp) {
      logger.debug(
        `[${SOURCE}] Tenant ${tenantId} bukan PKP, skip PPN Masukan`,
      );
      return null;
    }

    // 2. Idempotent check
    const existing = await this.txnRepo.findBySource(
      tenantId,
      "Expense",
      expenseId,
      "PPN_MASUKAN",
    );
    if (existing) {
      logger.debug(
        `[${SOURCE}] PPN Masukan already recorded for expense ${expenseId}`,
      );
      return existing;
    }

    // 3. Calculate tax amount
    const ppnRate = Number(config.ppnRate);
    let taxAmount: number;
    if (config.ppnIncluded) {
      const dpp = expenseAmount / (1 + ppnRate / 100);
      taxAmount = dpp * (ppnRate / 100);
    } else {
      taxAmount = expenseAmount * (ppnRate / 100);
    }
    taxAmount = Math.round(taxAmount * 100) / 100;

    // 4. Resolve COA
    const [debitCoaId, creditCoaId] = await Promise.all([
      resolveCoaId(tenantId, "1-250"), // PPN Masukan
      resolveCoaId(tenantId, "1-120"), // Kas/Bank
    ]);
    if (!debitCoaId || !creditCoaId) {
      throw new CoaNotFoundError(!debitCoaId ? "1-250" : "1-120");
    }

    // 5. Post journal
    const postingService = getJournalPostingService();
    const journal = await postingService.postAuto(tenantId, {
      source: "AUTO_TAX_PPN_MASUKAN",
      sourceRefType: "Expense",
      sourceRefId: expenseId,
      entryDate: expenseDate,
      description: `PPN Masukan ${ppnRate}% — Expense ${expenseId}`,
      lines: [
        { coaId: debitCoaId, side: "DEBIT", amount: String(taxAmount) },
        { coaId: creditCoaId, side: "CREDIT", amount: String(taxAmount) },
      ],
    });

    // 6. Create TaxTransaction record
    const periodYear = expenseDate.getFullYear();
    const periodMonth = expenseDate.getMonth() + 1;

    const txn = await this.txnRepo.create({
      tenantId,
      taxType: "PPN_MASUKAN",
      direction: "IN",
      amount: expenseAmount,
      taxAmount,
      rate: ppnRate,
      sourceRefType: "Expense",
      sourceRefId: expenseId,
      periodYear,
      periodMonth,
      journalId: journal.id,
      notes: `PPN Masukan ${ppnRate}% dari Expense ${expenseId}`,
    });

    logger.info(
      `[${SOURCE}] PPN Masukan recorded: ${taxAmount} for expense ${expenseId}`,
    );
    return txn;
  }
}
