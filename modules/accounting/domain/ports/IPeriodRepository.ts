import type {
  AccountingPeriod,
  PeriodStatus,
} from "../entities/AccountingPeriod";
import type { Prisma } from "@prisma/client";

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
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingPeriod>;
  list(tenantId: string): Promise<AccountingPeriod[]>;
  lockForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<AccountingPeriod | null>;
}
