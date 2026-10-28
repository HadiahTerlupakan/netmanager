import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { JournalRepository } from "../../repositories/JournalRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { PeriodService } from "../period/PeriodService";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import { JournalPostingService } from "./JournalPostingService";
import { JournalReverseService } from "./JournalReverseService";

/** Posting service untuk jurnal otomatis dari modul lain. */
export function autoPostingService() {
  const journalRepo = new JournalRepository();
  return new JournalPostingService(
    journalRepo,
    new ChartOfAccountRepository(),
    new PeriodRepository(),
    new JournalNumberGenerator(journalRepo),
  );
}

export function journalReverseService() {
  return new JournalReverseService(
    new JournalRepository(),
    new ChartOfAccountRepository(),
    new PeriodRepository(),
  );
}

/** Periode akuntansi dibuat saat jurnal pertama di bulan itu diposting. */
export async function ensurePeriod(tenantId: string, date: Date) {
  await new PeriodService(new PeriodRepository()).ensureCurrentPeriod(
    tenantId,
    date,
  );
}
