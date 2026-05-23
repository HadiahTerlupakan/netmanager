import type { TaxType, TaxDirection } from "../entities/TaxConfig";
import type { TaxTransaction } from "../entities/TaxTransaction";

export interface TaxTransactionCreateInput {
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
  journalId?: string;
  notes?: string;
  fakturPajakNo?: string | null;
  fakturPajakDate?: Date | null;
  counterpartNpwp?: string | null;
}

export interface TaxTransactionListFilter {
  tenantId: string;
  year: number;
  month?: number;
  taxType?: TaxType;
  page: number;
  limit: number;
}

export interface TaxTransactionListResult {
  items: TaxTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface ITaxTransactionRepository {
  create(input: TaxTransactionCreateInput): Promise<TaxTransaction>;
  findBySource(
    tenantId: string,
    sourceRefType: string,
    sourceRefId: string,
    taxType: TaxType,
  ): Promise<TaxTransaction | null>;
  findByPeriod(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxTransaction[]>;
  list(filter: TaxTransactionListFilter): Promise<TaxTransactionListResult>;
}
