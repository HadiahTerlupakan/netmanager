import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { AccountingPeriod } from "../../domain/entities/AccountingPeriod";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { Money } from "../../domain/value-objects/Money";
import { PeriodClosedError, AccountingError } from "../../errors";
import { hasPendingOutboxForPeriod } from "./outbox-check";

interface TrialRow {
  coa_id: string;
  coa_type: string;
  total_debit: string;
  total_credit: string;
}

export class PeriodCloseService {
  constructor(
    private readonly periodRepo: IPeriodRepository,
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
  ) {}

  async close(periodId: string, closedBy: string): Promise<AccountingPeriod> {
    const period = await this.periodRepo.findById(periodId);
    if (!period) {
      throw new AccountingError("Period tidak ditemukan", "PERIOD_NOT_FOUND");
    }
    if (!isPeriodWritable(period)) {
      throw new PeriodClosedError(period.year, period.month);
    }

    const hasPending = await hasPendingOutboxForPeriod(
      period.tenantId,
      period.startDate,
      period.endDate,
    );
    if (hasPending) {
      throw new AccountingError(
        "Masih ada event PENDING di outbox untuk periode ini",
        "OUTBOX_PENDING",
      );
    }

    return prisma.$transaction(async (tx) => {
      const locked = await this.periodRepo.lockForUpdate(periodId, tx);
      if (!locked || !isPeriodWritable(locked)) {
        throw new PeriodClosedError(period.year, period.month);
      }

      await this.periodRepo.updateStatus(periodId, "CLOSING", undefined, tx);
      await this.generateClosingJournals(tx, period, closedBy);
      const closed = await this.periodRepo.updateStatus(
        periodId,
        "CLOSED",
        closedBy,
        tx,
      );
      await this.ensureNextPeriod(period);

      return closed;
    });
  }

  async reopen(
    periodId: string,
    reopenedBy: string,
  ): Promise<AccountingPeriod> {
    const period = await this.periodRepo.findById(periodId);
    if (!period) {
      throw new AccountingError("Period tidak ditemukan", "PERIOD_NOT_FOUND");
    }
    if (period.status !== "CLOSED") {
      throw new AccountingError(
        "Hanya periode CLOSED yang bisa di-reopen",
        "PERIOD_NOT_CLOSED",
      );
    }

    return prisma.$transaction(async (tx) => {
      const reopened = await this.periodRepo.updateStatus(
        periodId,
        "REOPENED",
        reopenedBy,
        tx,
      );
      await this.reverseClosingJournals(tx, period);
      return reopened;
    });
  }

  private async generateClosingJournals(
    tx: Prisma.TransactionClient,
    period: AccountingPeriod,
    closedBy: string,
  ): Promise<void> {
    const trialData = await prisma.$queryRaw<TrialRow[]>`
      SELECT
        coa.id AS coa_id,
        coa.type::text AS coa_type,
        COALESCE(SUM(CASE WHEN jl.side = 'DEBIT' THEN jl.amount ELSE 0 END), 0)::text AS total_debit,
        COALESCE(SUM(CASE WHEN jl.side = 'CREDIT' THEN jl.amount ELSE 0 END), 0)::text AS total_credit
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."entryId"
      JOIN chart_of_accounts coa ON coa.id = jl."coaId"
      WHERE je."tenantId" = ${period.tenantId}
        AND je."periodId" = ${period.id}
        AND je.status = 'POSTED'
        AND coa.type IN ('REVENUE', 'EXPENSE')
      GROUP BY coa.id, coa.type
    `;

    let totalRevenue = Money.zero();
    let totalExpense = Money.zero();

    for (const row of trialData) {
      const debit = Money.fromString(row.total_debit);
      const credit = Money.fromString(row.total_credit);
      if (row.coa_type === "REVENUE") {
        totalRevenue = totalRevenue.add(credit.subtract(debit));
      } else {
        totalExpense = totalExpense.add(debit.subtract(credit));
      }
    }

    const labaRugiBerjalan = await this.coaRepo.findByCode(
      period.tenantId,
      "3-300",
    );
    const labaDitahan = await this.coaRepo.findByCode(period.tenantId, "3-200");
    if (!labaRugiBerjalan || !labaDitahan) {
      throw new AccountingError(
        "COA 3-300 atau 3-200 tidak ditemukan",
        "COA_NOT_FOUND",
      );
    }

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryDate = period.endDate;

    if (!totalRevenue.isZero()) {
      const revenueLines: JournalLineDraft[] = [];
      for (const row of trialData.filter((r) => r.coa_type === "REVENUE")) {
        const net = Money.fromString(row.total_credit).subtract(
          Money.fromString(row.total_debit),
        );
        if (!net.isZero()) {
          revenueLines.push({
            coaId: row.coa_id,
            side: "DEBIT",
            amount: net.toString(),
          });
        }
      }
      revenueLines.push({
        coaId: labaRugiBerjalan.id,
        side: "CREDIT",
        amount: totalRevenue.toString(),
      });

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-revenue`,
          description: `Closing revenue periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: revenueLines,
        },
        tx,
      );
    }

    if (!totalExpense.isZero()) {
      const expenseLines: JournalLineDraft[] = [
        {
          coaId: labaRugiBerjalan.id,
          side: "DEBIT",
          amount: totalExpense.toString(),
        },
      ];
      for (const row of trialData.filter((r) => r.coa_type === "EXPENSE")) {
        const net = Money.fromString(row.total_debit).subtract(
          Money.fromString(row.total_credit),
        );
        if (!net.isZero()) {
          expenseLines.push({
            coaId: row.coa_id,
            side: "CREDIT",
            amount: net.toString(),
          });
        }
      }

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-expense`,
          description: `Closing expense periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: expenseLines,
        },
        tx,
      );
    }

    const netIncome = totalRevenue.subtract(totalExpense);
    if (!netIncome.isZero()) {
      const isProfit = netIncome.isPositive();
      const absAmount = isProfit ? netIncome : Money.zero().subtract(netIncome);
      const transferLines: JournalLineDraft[] = isProfit
        ? [
            {
              coaId: labaRugiBerjalan.id,
              side: "DEBIT",
              amount: absAmount.toString(),
            },
            {
              coaId: labaDitahan.id,
              side: "CREDIT",
              amount: absAmount.toString(),
            },
          ]
        : [
            {
              coaId: labaDitahan.id,
              side: "DEBIT",
              amount: absAmount.toString(),
            },
            {
              coaId: labaRugiBerjalan.id,
              side: "CREDIT",
              amount: absAmount.toString(),
            },
          ];

      await this.journalRepo.create(
        {
          tenantId: period.tenantId,
          entryNumber: await numberGen.generate(period.tenantId, entryDate),
          entryDate,
          periodId: period.id,
          source: "CLOSING",
          sourceRefType: "Period",
          sourceRefId: `${period.id}-transfer`,
          description: `Transfer laba/rugi ke laba ditahan periode ${period.year}-${String(period.month).padStart(2, "0")}`,
          status: "POSTED",
          postedBy: closedBy,
          lines: transferLines,
        },
        tx,
      );
    }
  }

  private async reverseClosingJournals(
    tx: Prisma.TransactionClient,
    period: AccountingPeriod,
  ): Promise<void> {
    const closingJournals = await prisma.journalEntry.findMany({
      where: {
        tenantId: period.tenantId,
        periodId: period.id,
        source: "CLOSING",
        status: "POSTED",
      },
      select: { id: true },
    });

    for (const journal of closingJournals) {
      await this.journalRepo.markReversed(journal.id, journal.id, tx);
    }
  }

  private async ensureNextPeriod(current: AccountingPeriod): Promise<void> {
    const nextMonth = current.month === 12 ? 1 : current.month + 1;
    const nextYear = current.month === 12 ? current.year + 1 : current.year;

    const existing = await this.periodRepo.findByYearMonth(
      current.tenantId,
      nextYear,
      nextMonth,
    );
    if (!existing) {
      const startDate = new Date(nextYear, nextMonth - 1, 1);
      const endDate = new Date(nextYear, nextMonth, 0);
      await this.periodRepo.create({
        tenantId: current.tenantId,
        year: nextYear,
        month: nextMonth,
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        startDate,
        endDate,
      });
    }
  }
}
