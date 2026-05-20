import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { JournalEntry } from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import { validateBalance } from "./balanceValidator";
import {
  PeriodClosedError,
  AccountingError,
  CoaNotFoundError,
  CoaNotPostableError,
} from "../../errors";

export class OpeningBalanceService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  async post(
    tenantId: string,
    entryDate: Date,
    lines: JournalLineDraft[],
    postedBy: string,
  ): Promise<JournalEntry> {
    const existing = await this.journalRepo.findBySource(
      tenantId,
      "OPENING_BALANCE",
      tenantId,
    );
    if (existing) {
      throw new AccountingError(
        "Opening balance sudah pernah di-input untuk tenant ini",
        "OPENING_BALANCE_EXISTS",
      );
    }

    validateBalance(lines);

    const uniqueCoaIds = [...new Set(lines.map((l) => l.coaId))];
    for (const coaId of uniqueCoaIds) {
      const coa = await this.coaRepo.findById(coaId);
      if (!coa) throw new CoaNotFoundError(coaId);
      if (!coa.isPostable) throw new CoaNotPostableError(coa.code);
    }

    const period = await this.periodRepo.findByDate(tenantId, entryDate);
    if (!period || !isPeriodWritable(period)) {
      throw new PeriodClosedError(
        entryDate.getFullYear(),
        entryDate.getMonth() + 1,
      );
    }

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const entryNumber = await numberGen.generate(tenantId, entryDate);

    return this.journalRepo.create({
      tenantId,
      entryNumber,
      entryDate,
      periodId: period.id,
      source: "OPENING_BALANCE",
      sourceRefType: "Tenant",
      sourceRefId: tenantId,
      description: "Saldo awal (opening balance)",
      status: "POSTED",
      postedBy,
      lines,
    });
  }
}
