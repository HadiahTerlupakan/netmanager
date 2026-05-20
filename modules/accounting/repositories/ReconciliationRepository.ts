import { prisma } from "@/lib/prisma";
import type {
  IReconciliationRepository,
  ReconciliationCreateInput,
  ReconciliationLineInput,
} from "../domain/ports/IReconciliationRepository";
import type {
  BankReconciliation,
  BankReconciliationLine,
  MatchStatus,
} from "../domain/entities/BankReconciliation";

function toReconciliationLine(row: {
  id: string;
  reconciliationId: string;
  journalLineId: string | null;
  bankRefDate: Date;
  bankRefDescription: string;
  bankRefAmount: { toString(): string };
  matchStatus: string;
}): BankReconciliationLine {
  return {
    id: row.id,
    reconciliationId: row.reconciliationId,
    journalLineId: row.journalLineId,
    bankRefDate: row.bankRefDate,
    bankRefDescription: row.bankRefDescription,
    bankRefAmount: row.bankRefAmount.toString(),
    matchStatus: row.matchStatus as MatchStatus,
  };
}

function toReconciliation(row: {
  id: string;
  tenantId: string;
  coaId: string;
  statementDate: Date;
  statementBalance: { toString(): string };
  bookBalance: { toString(): string };
  reconciledBalance: { toString(): string };
  status: string;
  completedAt: Date | null;
  completedBy: string | null;
  lines: Array<{
    id: string;
    reconciliationId: string;
    journalLineId: string | null;
    bankRefDate: Date;
    bankRefDescription: string;
    bankRefAmount: { toString(): string };
    matchStatus: string;
  }>;
}): BankReconciliation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    coaId: row.coaId,
    statementDate: row.statementDate,
    statementBalance: row.statementBalance.toString(),
    bookBalance: row.bookBalance.toString(),
    reconciledBalance: row.reconciledBalance.toString(),
    status: row.status === "DRAFT_RECON" ? "DRAFT" : "COMPLETED",
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    lines: row.lines.map(toReconciliationLine),
  };
}

export class ReconciliationRepository implements IReconciliationRepository {
  async create(input: ReconciliationCreateInput): Promise<BankReconciliation> {
    const row = await prisma.bankReconciliation.create({
      data: {
        tenantId: input.tenantId,
        coaId: input.coaId,
        statementDate: input.statementDate,
        statementBalance: input.statementBalance,
        bookBalance: input.bookBalance,
        reconciledBalance: "0",
        status: "DRAFT_RECON",
      },
      include: { lines: true },
    });
    return toReconciliation(row);
  }

  async findById(id: string): Promise<BankReconciliation | null> {
    const row = await prisma.bankReconciliation.findUnique({
      where: { id },
      include: { lines: true },
    });
    return row ? toReconciliation(row) : null;
  }

  async list(tenantId: string, coaId?: string): Promise<BankReconciliation[]> {
    const rows = await prisma.bankReconciliation.findMany({
      where: { tenantId, ...(coaId && { coaId }) },
      include: { lines: true },
      orderBy: { statementDate: "desc" },
    });
    return rows.map(toReconciliation);
  }

  async addLines(lines: ReconciliationLineInput[]): Promise<void> {
    await prisma.bankReconciliationLine.createMany({
      data: lines.map((l) => ({
        reconciliationId: l.reconciliationId,
        journalLineId: l.journalLineId ?? null,
        bankRefDate: l.bankRefDate,
        bankRefDescription: l.bankRefDescription,
        bankRefAmount: l.bankRefAmount,
        matchStatus: l.matchStatus,
      })),
    });
  }

  async updateLineMatch(
    lineId: string,
    journalLineId: string | null,
    matchStatus: MatchStatus,
  ): Promise<void> {
    await prisma.bankReconciliationLine.update({
      where: { id: lineId },
      data: { journalLineId, matchStatus },
    });
  }

  async complete(
    id: string,
    reconciledBalance: string,
    completedBy: string,
  ): Promise<BankReconciliation> {
    const row = await prisma.bankReconciliation.update({
      where: { id },
      data: {
        reconciledBalance,
        status: "COMPLETED_RECON",
        completedAt: new Date(),
        completedBy,
      },
      include: { lines: true },
    });
    return toReconciliation(row);
  }
}
