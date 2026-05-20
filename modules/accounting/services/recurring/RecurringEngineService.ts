import type { IRecurringRepository } from "../../domain/ports/IRecurringRepository";
import type { IJournalRepository } from "../../domain/ports/IJournalRepository";
import type { IChartOfAccountRepository } from "../../domain/ports/IChartOfAccountRepository";
import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { RecurringJournalTemplate } from "../../domain/entities/RecurringJournalTemplate";
import type { JournalEntry } from "../../domain/entities/JournalEntry";
import { JournalPostingService } from "../journal/JournalPostingService";
import { JournalNumberGenerator } from "../journal/JournalNumberGenerator";
import { PeriodService } from "../period/PeriodService";
import { logger } from "@/lib/logger";

export class RecurringEngineService {
  constructor(
    private readonly recurringRepo: IRecurringRepository,
    private readonly journalRepo: IJournalRepository,
    private readonly coaRepo: IChartOfAccountRepository,
    private readonly periodRepo: IPeriodRepository,
  ) {}

  async processAll(
    today: Date = new Date(),
  ): Promise<{ generated: number; skipped: number; errors: number }> {
    const templates = await this.recurringRepo.findDueToday(today);
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    for (const template of templates) {
      if (!this.isDueForFrequency(template, today)) {
        skipped++;
        continue;
      }

      try {
        await this.generateJournal(template, today);
        await this.recurringRepo.markGenerated(template.id, today);
        generated++;
      } catch (error) {
        errors++;
        logger.error(
          `[RecurringEngine] Failed to generate journal for template ${template.id}:`,
          error,
        );
      }
    }

    logger.info(
      `[RecurringEngine] Processed: generated=${generated}, skipped=${skipped}, errors=${errors}`,
    );
    return { generated, skipped, errors };
  }

  private isDueForFrequency(
    template: RecurringJournalTemplate,
    today: Date,
  ): boolean {
    const month = today.getMonth() + 1;

    switch (template.frequency) {
      case "MONTHLY":
        return true;
      case "QUARTERLY":
        return month % 3 === 1;
      case "YEARLY":
        return month === 1;
      default:
        return false;
    }
  }

  private async generateJournal(
    template: RecurringJournalTemplate,
    today: Date,
  ): Promise<JournalEntry> {
    const periodService = new PeriodService(this.periodRepo);
    await periodService.ensureCurrentPeriod(template.tenantId, today);

    const numberGen = new JournalNumberGenerator(this.journalRepo);
    const postingService = new JournalPostingService(
      this.journalRepo,
      this.coaRepo,
      this.periodRepo,
      numberGen,
    );

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const sourceRefId = `${template.id}-${year}-${month}`;

    return postingService.postAuto(template.tenantId, {
      source: "RECURRING",
      sourceRefType: "RecurringJournalTemplate",
      sourceRefId,
      entryDate: today,
      description: `Recurring: ${template.name}`,
      lines: template.templateLines.map((line, idx) => ({
        coaId: line.coaId,
        side: line.side,
        amount: line.amount,
        description: line.description ?? undefined,
        lineOrder: idx + 1,
      })),
    });
  }
}
