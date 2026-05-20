import type { DebitCredit } from "./ChartOfAccount";

export interface JournalLine {
  id: string;
  entryId: string;
  coaId: string;
  side: DebitCredit;
  amount: string;
  description: string | null;
  lineOrder: number;
}

export interface JournalLineDraft {
  coaId: string;
  side: DebitCredit;
  amount: string;
  description?: string | null;
  lineOrder?: number;
}
