import type { JournalLine } from "./JournalLine";

export type JournalSource =
  | "AUTO_INVOICE_PAID"
  | "AUTO_INVOICE_CREATED"
  | "AUTO_PAYMENT"
  | "AUTO_EXPENSE"
  | "AUTO_PO_PAID"
  | "MANUAL"
  | "RECURRING"
  | "REVERSAL"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "CLOSING";

export type JournalStatus = "DRAFT" | "POSTED" | "REVERSED";

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryNumber: string;
  entryDate: Date;
  periodId: string;
  source: JournalSource;
  sourceRefType: string | null;
  sourceRefId: string | null;
  description: string;
  status: JournalStatus;
  reversalOfId: string | null;
  postedAt: Date | null;
  postedBy: string | null;
  lines: JournalLine[];
  createdAt: Date;
  updatedAt: Date;
}
