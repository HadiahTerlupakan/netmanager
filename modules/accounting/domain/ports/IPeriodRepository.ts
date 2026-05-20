import type {
  AccountingPeriod,
  PeriodStatus,
} from "../entities/AccountingPeriod";

export type TransactionClient = unknown;

export interface IPeriodRepository {
  findById(id: string): Promise<AccountingPeriod | null>;
  findByYearMonth(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<AccountingPeriod | null>;
  findByDate(tenantId: string, date: Date): Promise<AccountingPeriod | null>;
  create(period: Omit<AccountingPeriod, "id">): Promise<AccountingPeriod>;
  updateStatus(
    id: string,
    status: PeriodStatus,
    closedBy?: string,
    tx?: TransactionClient,
  ): Promise<AccountingPeriod>;
  list(tenantId: string): Promise<AccountingPeriod[]>;
  lockForUpdate(
    id: string,
    tx: TransactionClient,
  ): Promise<AccountingPeriod | null>;
}
