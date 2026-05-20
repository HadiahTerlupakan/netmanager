import type { JournalEntry } from "../domain/entities/JournalEntry";
import type { JournalLine } from "../domain/entities/JournalLine";

export interface JournalLineResponseDto {
  id: string;
  coaId: string;
  side: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  lineOrder: number;
}

export interface JournalResponseDto {
  id: string;
  entryNumber: string;
  entryDate: string;
  source: string;
  sourceRefType: string | null;
  sourceRefId: string | null;
  description: string;
  status: string;
  reversalOfId: string | null;
  postedAt: string | null;
  postedBy: string | null;
  lines: JournalLineResponseDto[];
  createdAt: string;
}

export interface JournalListResponseDto {
  items: JournalResponseDto[];
  total: number;
  page: number;
  limit: number;
}

export function toJournalResponseDto(entry: JournalEntry): JournalResponseDto {
  return {
    id: entry.id,
    entryNumber: entry.entryNumber,
    entryDate: entry.entryDate.toISOString(),
    source: entry.source,
    sourceRefType: entry.sourceRefType,
    sourceRefId: entry.sourceRefId,
    description: entry.description,
    status: entry.status,
    reversalOfId: entry.reversalOfId,
    postedAt: entry.postedAt?.toISOString() ?? null,
    postedBy: entry.postedBy,
    lines: entry.lines.map(toJournalLineDto),
    createdAt: entry.createdAt.toISOString(),
  };
}

function toJournalLineDto(line: JournalLine): JournalLineResponseDto {
  return {
    id: line.id,
    coaId: line.coaId,
    side: line.side,
    amount: line.amount,
    description: line.description,
    lineOrder: line.lineOrder,
  };
}
