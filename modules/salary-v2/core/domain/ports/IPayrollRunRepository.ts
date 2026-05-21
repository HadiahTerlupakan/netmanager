import type { PayrollRun } from "../entities/PayrollRun";
import type { PayrollRunStatus, PayrollRunType } from "../enums";

export interface PayrollRunFilter {
  tenantId: string;
  scheduleId?: string;
  type?: PayrollRunType;
  status?: PayrollRunStatus;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface IPayrollRunRepository {
  findById(id: string, tenantId: string): Promise<PayrollRun | null>;
  findAll(filter: PayrollRunFilter): Promise<PayrollRun[]>;
  create(
    data: Omit<PayrollRun, "id" | "createdAt" | "updatedAt">,
  ): Promise<PayrollRun>;
  update(
    id: string,
    tenantId: string,
    data: Partial<PayrollRun>,
  ): Promise<PayrollRun>;
  updateStatus(
    id: string,
    tenantId: string,
    status: PayrollRunStatus,
  ): Promise<PayrollRun>;
  delete(id: string, tenantId: string): Promise<void>;
}
