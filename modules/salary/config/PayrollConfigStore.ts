import type { TenantPayrollConfig } from "@/modules/salary/core";
import {
  DEFAULT_BPJS_CONFIG,
  DEFAULT_TAX_CONFIG,
  DEFAULT_OVERTIME_CONFIG,
} from "@/modules/salary/core";

/**
 * In-memory payroll config store (MVP).
 * TODO: Persist to database (TenantSettings or dedicated table) for production use.
 */
const configCache = new Map<string, TenantPayrollConfig>();

/** Retrieve tenant payroll config, returning defaults if none saved */
export function getPayrollConfig(tenantId: string): TenantPayrollConfig {
  if (configCache.has(tenantId)) {
    return configCache.get(tenantId)!;
  }
  return getDefaultConfig(tenantId);
}

/** Save/update tenant payroll config (partial merge) */
export function savePayrollConfig(
  tenantId: string,
  config: Partial<TenantPayrollConfig>,
): TenantPayrollConfig {
  const current = getPayrollConfig(tenantId);
  const updated: TenantPayrollConfig = {
    ...current,
    ...config,
    tenantId,
  };
  configCache.set(tenantId, updated);
  return updated;
}

function getDefaultConfig(tenantId: string): TenantPayrollConfig {
  return {
    tenantId,
    bpjs: DEFAULT_BPJS_CONFIG,
    tax: DEFAULT_TAX_CONFIG,
    overtime: DEFAULT_OVERTIME_CONFIG,
    thrConfig: {
      eligibleAfterMonths: 1,
      fullEntitlementMonths: 12,
      prorata: true,
      components: ["BASIC_SALARY"],
      paymentDeadlineDays: 7,
    },
    advancePolicy: {
      maxPercentOfSalary: 0.3,
      maxActiveAdvances: 2,
      minDaysBetweenRequests: 30,
      approvalRequired: true,
      deductionMethod: "FULL_NEXT",
      maxInstallments: 6,
    },
    periodLocking: {
      autoLockAfterPaid: true,
      autoLockDelayDays: 3,
      requireApprovalToUnlock: true,
      maxUnlockCount: 2,
    },
  };
}
