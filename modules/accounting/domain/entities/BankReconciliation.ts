export type ReconStatus = "DRAFT" | "COMPLETED";
export type MatchStatus = "MATCHED" | "UNMATCHED" | "MANUAL_MATCH";

export interface BankReconciliationLine {
  id: string;
  reconciliationId: string;
  journalLineId: string | null;
  bankRefDate: Date;
  bankRefDescription: string;
  bankRefAmount: string;
  matchStatus: MatchStatus;
}

export interface BankReconciliation {
  id: string;
  tenantId: string;
  coaId: string;
  statementDate: Date;
  statementBalance: string;
  bookBalance: string;
  reconciledBalance: string;
  status: ReconStatus;
  completedAt: Date | null;
  completedBy: string | null;
  lines: BankReconciliationLine[];
}
