import type { PayrollRunStatus, PayrollRunType } from "../enums";

export interface PayrollRun {
  id: string;
  tenantId: string;
  scheduleId: string;
  type: PayrollRunType;
  status: PayrollRunStatus;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  totalEntries: number;
  totalNetSalary: number;
  totalEmployerCost: number;
  lockedAt: Date | null;
  lockedBy: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
