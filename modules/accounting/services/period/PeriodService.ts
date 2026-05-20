import type { IPeriodRepository } from "../../domain/ports/IPeriodRepository";
import type { AccountingPeriod } from "../../domain/entities/AccountingPeriod";

export class PeriodService {
  constructor(private readonly periodRepo: IPeriodRepository) {}

  async ensureCurrentPeriod(
    tenantId: string,
    date: Date,
  ): Promise<AccountingPeriod> {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    const existing = await this.periodRepo.findByYearMonth(
      tenantId,
      year,
      month,
    );
    if (existing) return existing;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    return this.periodRepo.create({
      tenantId,
      year,
      month,
      status: "OPEN",
      closedAt: null,
      closedBy: null,
      startDate,
      endDate,
    });
  }

  async findByDate(
    tenantId: string,
    date: Date,
  ): Promise<AccountingPeriod | null> {
    return this.periodRepo.findByDate(tenantId, date);
  }

  async list(tenantId: string): Promise<AccountingPeriod[]> {
    return this.periodRepo.list(tenantId);
  }
}
