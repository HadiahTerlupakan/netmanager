import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import {
  AccountingError,
  JournalAlreadyReversedError,
  PeriodClosedError,
} from "../../errors";

export class JournalReverseService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly _coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  async reverse(
    journalId: string,
    reason: string,
    reversedBy: string,
  ): Promise<JournalEntry> {
    const original = await this.journalRepo.findById(journalId);
    if (!original) {
      throw new AccountingError("Journal tidak ditemukan", "JOURNAL_NOT_FOUND");
    }
    if (original.status === "REVERSED") {
      throw new JournalAlreadyReversedError(original.entryNumber);
    }
    if (original.status !== "POSTED") {
      throw new AccountingError(
        "Hanya journal POSTED yang bisa di-reverse",
        "JOURNAL_NOT_POSTED",
      );
    }

    const period = await this.periodRepo.findByDate(
      original.tenantId,
      new Date(),
    );
    if (!period || !isPeriodWritable(period)) {
      const now = new Date();
      throw new PeriodClosedError(now.getFullYear(), now.getMonth() + 1);
    }

    const reversalLines: JournalLineDraft[] = original.lines.map((line) => ({
      coaId: line.coaId,
      side: line.side === "DEBIT" ? ("CREDIT" as const) : ("DEBIT" as const),
      amount: line.amount,
      description: line.description ?? undefined,
      lineOrder: line.lineOrder,
    }));

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryDate = new Date();
    const entryNumber = await numberGen.generate(original.tenantId, entryDate);

    const reversal = await this.journalRepo.create({
      tenantId: original.tenantId,
      entryNumber,
      entryDate,
      periodId: period.id,
      source: "REVERSAL",
      sourceRefType: "JournalEntry",
      sourceRefId: original.id,
      description: `Reversal: ${original.entryNumber} — ${reason}`,
      status: "POSTED",
      reversalOfId: original.id,
      postedBy: reversedBy,
      lines: reversalLines,
    });

    await this.journalRepo.markReversed(original.id, reversal.id);

    return reversal;
  }
}
