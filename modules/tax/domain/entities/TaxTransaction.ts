import type { TaxType, TaxDirection } from "./TaxConfig";

export interface TaxTransaction {
  id: string;
  tenantId: string;
  taxType: TaxType;
  direction: TaxDirection;
  amount: number;
  taxAmount: number;
  rate: number;
  sourceRefType: string;
  sourceRefId: string;
  periodYear: number;
  periodMonth: number;
  journalId: string | null;
  notes: string | null;
  createdAt: Date;
}
