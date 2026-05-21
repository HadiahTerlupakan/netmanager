import type { TaxPeriodSummary } from "../entities/TaxPeriod";
import type { TaxType } from "../entities/TaxConfig";

export interface ITaxPeriodRepository {
  findByPeriod(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<TaxPeriodSummary | null>;
  upsert(
    tenantId: string,
    year: number,
    month: number,
    data: Partial<TaxPeriodSummary>,
  ): Promise<TaxPeriodSummary>;
  markPaid(
    tenantId: string,
    year: number,
    month: number,
    taxType: TaxType,
    paidAt: Date,
  ): Promise<void>;
  lock(tenantId: string, year: number, month: number): Promise<void>;
  listByYear(tenantId: string, year: number): Promise<TaxPeriodSummary[]>;
}
