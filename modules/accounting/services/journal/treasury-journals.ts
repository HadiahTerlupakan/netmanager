import { ChartOfAccountRepository } from "../../repositories/ChartOfAccountRepository";
import { JournalRepository } from "../../repositories/JournalRepository";
import { PeriodRepository } from "../../repositories/PeriodRepository";
import { getCoaCode } from "../event-handlers/coa-mapping-config";
import { PeriodService } from "../period/PeriodService";
import { JournalNumberGenerator } from "./JournalNumberGenerator";
import { JournalPostingService } from "./JournalPostingService";

/**
 * Jurnal untuk rekening Kas & Bank. Saldo rekening yang ditautkan ke COA
 * dihitung dari jurnal, jadi setiap perubahan dananya harus berjurnal: dulu
 * transfer antar rekening dan saldo awal hanya mengubah angka tersimpan, dan
 * angka itu tidak pernah cocok dengan buku besar maupun arus kas.
 */
function postingService() {
  const journalRepo = new JournalRepository();
  return new JournalPostingService(
    journalRepo,
    new ChartOfAccountRepository(),
    new PeriodRepository(),
    new JournalNumberGenerator(journalRepo),
  );
}

async function ensurePeriod(tenantId: string, date: Date) {
  await new PeriodService(new PeriodRepository()).ensureCurrentPeriod(
    tenantId,
    date,
  );
}

/** Pindah dana antar rekening: Debit rekening tujuan, Kredit rekening asal. */
export async function postTreasuryTransferJournal(input: {
  tenantId: string;
  mutationId: string;
  date: Date;
  amount: number;
  sourceCoaId: string;
  destinationCoaId: string;
  description?: string;
  postedBy?: string;
}) {
  await ensurePeriod(input.tenantId, input.date);
  const amount = String(input.amount);
  return postingService().postAuto(input.tenantId, {
    source: "MANUAL",
    sourceRefType: "TreasuryMutation",
    sourceRefId: input.mutationId,
    entryDate: input.date,
    description: input.description || "Pindah dana antar rekening",
    lines: [
      { coaId: input.destinationCoaId, side: "DEBIT", amount },
      { coaId: input.sourceCoaId, side: "CREDIT", amount },
    ],
    ...(input.postedBy ? { postedBy: input.postedBy } : {}),
  });
}

/** Saldo awal rekening baru: Debit rekening, Kredit Modal Disetor. */
export async function postAccountOpeningJournal(input: {
  tenantId: string;
  accountId: string;
  accountName: string;
  coaId: string;
  amount: number;
  date: Date;
}) {
  await ensurePeriod(input.tenantId, input.date);
  const repo = new ChartOfAccountRepository();
  const equity = await repo.findByCode(
    input.tenantId,
    await getCoaCode(input.tenantId, "MODAL_DISETOR"),
  );
  if (!equity) throw new Error("COA Modal Disetor belum tersedia");
  const amount = String(input.amount);
  return postingService().postAuto(input.tenantId, {
    source: "OPENING_BALANCE",
    sourceRefType: "FinancialAccount",
    sourceRefId: input.accountId,
    entryDate: input.date,
    description: `Saldo awal rekening ${input.accountName}`,
    lines: [
      { coaId: input.coaId, side: "DEBIT", amount },
      { coaId: equity.id, side: "CREDIT", amount },
    ],
  });
}
