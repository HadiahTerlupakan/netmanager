import type { SalaryAdvanceStatus } from "../enums";

export type DeductionMethod = "FULL_NEXT" | "INSTALLMENT";

export interface SalaryAdvance {
  id: string;
  tenantId: string;
  userId: string;
  amount: number;
  requestDate: Date;
  approvedBy: string | null;
  approvedAt: Date | null;
  status: SalaryAdvanceStatus;
  deductionMethod: DeductionMethod;
  installmentCount: number | null;
  remainingAmount: number;
  reason: string | null;
  rejectionReason: string | null;
  disbursedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
