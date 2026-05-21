import type { BpjsRateConfig } from "./BpjsConfig";
import type { TenantTaxConfig } from "./TaxConfig";
import type { OvertimeConfig } from "./OvertimeConfig";
import type { DeductionMethod } from "../domain/entities/SalaryAdvance";

export interface ThrConfig {
  eligibleAfterMonths: number;
  fullEntitlementMonths: number;
  prorata: boolean;
  components: string[];
  paymentDeadlineDays: number;
}

export interface SalaryAdvancePolicy {
  maxPercentOfSalary: number;
  maxActiveAdvances: number;
  minDaysBetweenRequests: number;
  approvalRequired: boolean;
  deductionMethod: DeductionMethod;
  maxInstallments: number;
}

export interface PeriodLockingPolicy {
  autoLockAfterPaid: boolean;
  autoLockDelayDays: number;
  requireApprovalToUnlock: boolean;
  maxUnlockCount: number;
}

export interface TenantPayrollConfig {
  tenantId: string;
  bpjs: BpjsRateConfig;
  tax: TenantTaxConfig;
  overtime: OvertimeConfig;
  thrConfig: ThrConfig;
  advancePolicy: SalaryAdvancePolicy;
  periodLocking: PeriodLockingPolicy;
}
