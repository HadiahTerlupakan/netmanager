import type { AccountingPeriod as PrismaPeriod } from "@prisma/client";
import type { AccountingPeriod } from "../domain/entities/AccountingPeriod";

export function toAccountingPeriod(row: PrismaPeriod): AccountingPeriod {
  return {
    id: row.id,
    tenantId: row.tenantId,
    year: row.year,
    month: row.month,
    status: row.status,
    closedAt: row.closedAt,
    closedBy: row.closedBy,
    startDate: row.startDate,
    endDate: row.endDate,
  };
}
