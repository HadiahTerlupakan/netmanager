export type PeriodStatus = "OPEN" | "CLOSING" | "CLOSED" | "REOPENED";

export interface AccountingPeriod {
  id: string;
  tenantId: string;
  year: number;
  month: number;
  status: PeriodStatus;
  closedAt: Date | null;
  closedBy: string | null;
  startDate: Date;
  endDate: Date;
}

export function isPeriodWritable(p: AccountingPeriod): boolean {
  return p.status === "OPEN" || p.status === "REOPENED";
}
