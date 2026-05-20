import type {
  BankReconciliation,
  MatchStatus,
} from "../entities/BankReconciliation";

export interface ReconciliationCreateInput {
  tenantId: string;
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
}

export interface ReconciliationLineInput {
  reconciliationId: string;
  journalLineId?: string | null;
  bankRefDate: Date;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: MatchStatus;
}

export interface IReconciliationRepository {
  create(input: ReconciliationCreateInput): Promise<BankReconciliation>;
  findById(id: string): Promise<BankReconciliation | null>;
  list(tenantId: string, coaId?: string): Promise<BankReconciliation[]>;
  addLines(lines: ReconciliationLineInput[]): Promise<void>;
  updateLineMatch(
    lineId: string,
    journalLineId: string | null,
    matchStatus: MatchStatus,
  ): Promise<void>;
  complete(
    id: string,
    reconciledBalance: string,
    completedBy: string,
  ): Promise<BankReconciliation>;
}
