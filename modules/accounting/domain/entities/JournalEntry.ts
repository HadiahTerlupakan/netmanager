import type { JournalLine } from "./JournalLine";

export type JournalSource =
  | "AUTO_INVOICE_PAID"
  | "AUTO_INVOICE_CREATED"
  | "AUTO_PAYMENT"
  | "AUTO_EXPENSE"
  | "AUTO_PO_PAID"
  | "AUTO_COUPON_USED"
  | "AUTO_MITRA_WITHDRAWAL"
  | "AUTO_INVESTOR_PAYOUT"
  | "AUTO_INVESTOR_DEPOSIT"
  | "AUTO_SALARY"
  | "AUTO_SALARY_ADVANCE"
  | "AUTO_TAX_PPN_KELUARAN"
  | "AUTO_TAX_PPN_MASUKAN"
  | "AUTO_TAX_PPH_21"
  | "AUTO_TAX_PPH_23"
  | "AUTO_TAX_PPH_4_2"
  | "AUTO_TAX_BHP"
  | "AUTO_TAX_USO"
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
