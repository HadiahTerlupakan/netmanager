import type {
  JournalEntry as PrismaJournalEntry,
  JournalLine as PrismaJournalLine,
} from "@prisma/client";
import type { JournalEntry } from "../domain/entities/JournalEntry";
import type { JournalLine } from "../domain/entities/JournalLine";

export function toJournalLine(row: PrismaJournalLine): JournalLine {
  return {
    id: row.id,
    entryId: row.entryId,
    coaId: row.coaId,
    side: row.side,
    amount: row.amount.toString(),
    description: row.description,
    lineOrder: row.lineOrder,
  };
}

export function toJournalEntry(
  row: PrismaJournalEntry & { lines: PrismaJournalLine[] },
): JournalEntry {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entryNumber: row.entryNumber,
    entryDate: row.entryDate,
    periodId: row.periodId,
    source: row.source,
    sourceRefType: row.sourceRefType,
    sourceRefId: row.sourceRefId,
    description: row.description,
    status: row.status,
    reversalOfId: row.reversalOfId,
    postedAt: row.postedAt,
    postedBy: row.postedBy,
    lines: row.lines
      .map(toJournalLine)
      .sort((a, b) => a.lineOrder - b.lineOrder),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
