import type {
  IJournalRepository,
  JournalCreateInput,
} from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type {
  JournalEntry,
  JournalSource,
} from "../../domain/entities/JournalEntry";
import type { JournalLineDraft } from "../../domain/entities/JournalLine";
import { isPeriodWritable } from "../../domain/entities/AccountingPeriod";
import { validateBalance } from "./balanceValidator";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import {
  PeriodClosedError,
  CoaNotFoundError,
  CoaNotPostableError,
} from "../../errors";

export interface PostManualDto {
  entryDate: Date;
  description: string;
  lines: JournalLineDraft[];
}

export interface PostAutoParams {
  source: JournalSource;
  sourceRefType: string;
  sourceRefId: string;
  entryDate: Date;
  description: string;
  lines: JournalLineDraft[];
  postedBy?: string;
}

export class JournalPostingService {
  constructor(
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
    private readonly numberGen: JournalNumberGenerator,
  ) {}

  async postManual(
    tenantId: string,
    dto: PostManualDto,
    postedBy: string,
  ): Promise<JournalEntry> {
    validateBalance(dto.lines);
    await this.validateCoaIds(dto.lines);
    const period = await this.getWritablePeriod(tenantId, dto.entryDate);
    const entryNumber = await this.numberGen.generate(tenantId, dto.entryDate);

    const input: JournalCreateInput = {
      tenantId,
      entryNumber,
      entryDate: dto.entryDate,
      periodId: period.id,
      source: "MANUAL",
      description: dto.description,
      status: "POSTED",
      postedBy,
      lines: dto.lines,
    };

    return this.journalRepo.create(input);
  }

  async postAuto(
    tenantId: string,
    params: PostAutoParams,
  ): Promise<JournalEntry> {
    const existing = await this.journalRepo.findBySource(
      tenantId,
      params.source,
      params.sourceRefId,
    );
    if (existing) {
      return existing;
    }

    validateBalance(params.lines);
    await this.validateCoaIds(params.lines);
    const period = await this.getWritablePeriod(tenantId, params.entryDate);
    const entryNumber = await this.numberGen.generate(
      tenantId,
      params.entryDate,
    );

    const input: JournalCreateInput = {
      tenantId,
      entryNumber,
      entryDate: params.entryDate,
      periodId: period.id,
      source: params.source,
      sourceRefType: params.sourceRefType,
      sourceRefId: params.sourceRefId,
      description: params.description,
      status: "POSTED",
      postedBy: params.postedBy ?? null,
      lines: params.lines,
    };

    return this.journalRepo.create(input);
  }

  private async validateCoaIds(lines: JournalLineDraft[]): Promise<void> {
    const uniqueCoaIds = [...new Set(lines.map((l) => l.coaId))];
    for (const coaId of uniqueCoaIds) {
      const coa = await this.coaRepo.findById(coaId);
      if (!coa) {
        throw new CoaNotFoundError(coaId);
      }
      if (!coa.isPostable) {
        throw new CoaNotPostableError(coa.code);
      }
    }
  }

  private async getWritablePeriod(tenantId: string, entryDate: Date) {
    const period = await this.periodRepo.findByDate(tenantId, entryDate);
    if (!period) {
      throw new PeriodClosedError(
        entryDate.getFullYear(),
        entryDate.getMonth() + 1,
      );
    }
    if (!isPeriodWritable(period)) {
      throw new PeriodClosedError(period.year, period.month);
    }
    return period;
  }
}
