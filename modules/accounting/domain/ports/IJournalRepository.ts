import type {
  JournalEntry,
  JournalSource,
  JournalStatus,
} from "../entities/JournalEntry";
import type { JournalLineDraft } from "../entities/JournalLine";

export type TransactionClient = unknown;

export interface JournalCreateInput {
  tenantId: string;
  entryNumber: string;
  entryDate: Date;
  periodId: string;
  source: JournalSource;
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  description: string;
  status?: JournalStatus;
  reversalOfId?: string | null;
  postedBy?: string | null;
  lines: JournalLineDraft[];
}

export interface JournalListFilter {
  tenantId: string;
  from?: Date;
  to?: Date;
  source?: JournalSource;
  status?: JournalStatus;
  coaId?: string;
  skip?: number;
  take?: number;
}

export interface IJournalRepository {
  create(
    input: JournalCreateInput,
    tx?: TransactionClient,
  ): Promise<JournalEntry>;
  findById(id: string): Promise<JournalEntry | null>;
  findBySource(
    tenantId: string,
    source: JournalSource,
    sourceRefId: string,
  ): Promise<JournalEntry | null>;
  list(
    filter: JournalListFilter,
  ): Promise<{ items: JournalEntry[]; total: number }>;
  markReversed(
    id: string,
    reversalEntryId: string,
    tx?: TransactionClient,
  ): Promise<void>;
  countByMonth(tenantId: string, year: number, month: number): Promise<number>;
}
