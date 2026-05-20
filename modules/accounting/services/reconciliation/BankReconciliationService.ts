import type {
  IReconciliationRepository,
  ReconciliationLineInput,
} from "../../domain/ports/IReconciliationRepository";
import type {
  BankReconciliation,
  MatchStatus,
} from "../../domain/entities/BankReconciliation";
import { Money } from "../../domain/value-objects/Money";
import { AccountingError } from "../../errors";
import type { BankStatementRow } from "./csvParser";

interface CreateInput {
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
}

export class BankReconciliationService {
  constructor(private readonly reconRepo: IReconciliationRepository) {}

  async create(
    tenantId: string,
    input: CreateInput,
  ): Promise<BankReconciliation> {
    return this.reconRepo.create({
      tenantId,
      coaId: input.coaId,
      statementDate: input.statementDate,
      statementBalance: input.statementBalance,
      bookBalance: input.bookBalance,
    });
  }

  async loadBankRows(
    reconciliationId: string,
    rows: BankStatementRow[],
  ): Promise<void> {
    const lines: ReconciliationLineInput[] = rows.map((row) => ({
      reconciliationId,
      bankRefDate: row.date,
      bankRefDescription: row.description,
      bankRefAmount: row.amount,
      matchStatus: "UNMATCHED" as MatchStatus,
    }));
    await this.reconRepo.addLines(lines);
  }

  async manualMatch(lineId: string, journalLineId: string): Promise<void> {
    await this.reconRepo.updateLineMatch(lineId, journalLineId, "MANUAL_MATCH");
  }

  async unmatch(lineId: string): Promise<void> {
    await this.reconRepo.updateLineMatch(lineId, null, "UNMATCHED");
  }

  async complete(
    reconciliationId: string,
    completedBy: string,
  ): Promise<BankReconciliation> {
    const recon = await this.reconRepo.findById(reconciliationId);
    if (!recon) {
      throw new AccountingError(
        "Reconciliation tidak ditemukan",
        "RECON_NOT_FOUND",
      );
    }
    if (recon.status === "COMPLETED") {
      throw new AccountingError(
        "Reconciliation sudah selesai",
        "RECON_ALREADY_COMPLETED",
      );
    }

    const matchedTotal = recon.lines
      .filter((l) => l.matchStatus !== "UNMATCHED")
      .reduce(
        (sum, l) => sum.add(Money.fromString(l.bankRefAmount)),
        Money.zero(),
      );

    return this.reconRepo.complete(
      reconciliationId,
      matchedTotal.toString(),
      completedBy,
    );
  }

  async findById(id: string): Promise<BankReconciliation | null> {
    return this.reconRepo.findById(id);
  }

  async list(tenantId: string, coaId?: string): Promise<BankReconciliation[]> {
    return this.reconRepo.list(tenantId, coaId);
  }
}
