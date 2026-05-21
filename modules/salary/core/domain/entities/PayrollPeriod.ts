import type { PayrollPeriodStatus } from "../enums";

export interface PayrollPeriod {
  id: string;
  tenantId: string;
  scheduleId: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  status: PayrollPeriodStatus;
  lockedAt: Date | null;
  lockedBy: string | null;
  unlockReason: string | null;
  unlockCount: number;
  createdAt: Date;
  updatedAt: Date;
}
