import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors, createHandler } from "@/lib/api";
import {
  getPayrollConfig,
  savePayrollConfig,
  type TenantPayrollConfig,
} from "@/modules/salary";
import * as z from "zod";

// ============================================================================
// Validation Schema
// ============================================================================

const bpjsProgramRateSchema = z.object({
  employeeRate: z.number().min(0).max(1),
  employerRate: z.number().min(0).max(1),
  maxBase: z.number().nullable(),
  maxAge: z.number().optional(),
});

const bpjsEmployerOnlyRateSchema = z.object({
  employerRate: z.number().min(0).max(1),
  riskCategory: z.number().optional(),
});

const bpjsConfigSchema = z.object({
  kesehatan: bpjsProgramRateSchema,
  jht: bpjsProgramRateSchema,
  jp: bpjsProgramRateSchema.extend({ maxAge: z.number() }),
  jkk: bpjsEmployerOnlyRateSchema,
  jkm: bpjsEmployerOnlyRateSchema,
});

const taxConfigSchema = z.object({
  defaultMethod: z.enum(["NET", "GROSS_UP", "NETT"]),
  terYear: z.number().int(),
  npwpSurcharge: z.number().min(0).max(1),
  annualCorrectionMonth: z.number().int().min(1).max(12),
  biayaJabatanRate: z.number().min(0).max(1),
  biayaJabatanMax: z.number().min(0),
  biayaJabatanMaxAnnual: z.number().min(0),
  progressiveRates: z.array(
    z.object({
      minAmount: z.number(),
      maxAmount: z.number().nullable(),
      rate: z.number().min(0).max(1),
    }),
  ),
  terBrackets: z.array(
    z.object({
      ptkpGroup: z.string(),
      minIncome: z.number(),
      maxIncome: z.number().nullable(),
      rate: z.number().min(0).max(1),
    }),
  ),
  ptkpTable: z.array(
    z.object({
      status: z.string(),
      annualAmount: z.number(),
    }),
  ),
});

const overtimeConfigSchema = z.object({
  maxHoursPerDay: z.number().min(0),
  maxHoursPerWeek: z.number().min(0),
  maxHoursPerMonth: z.number().nullable(),
  rateBase: z.enum(["1/173", "custom"]),
  customRateBase: z.number().nullable(),
  capEnforcement: z.enum(["SOFT_WARNING", "HARD_BLOCK", "NONE"]),
  exceptionRoles: z.array(z.string()),
  tiers: z.array(
    z.object({
      dayType: z.enum(["WORKDAY", "HOLIDAY", "NATIONAL_HOLIDAY"]),
      fromHour: z.number().min(0),
      toHour: z.number().nullable(),
      multiplier: z.number().min(0),
    }),
  ),
});

const thrConfigSchema = z.object({
  eligibleAfterMonths: z.number().int().min(0),
  fullEntitlementMonths: z.number().int().min(1),
  prorata: z.boolean(),
  components: z.array(z.string()),
  paymentDeadlineDays: z.number().int().min(1),
});

const advancePolicySchema = z.object({
  maxPercentOfSalary: z.number().min(0).max(1),
  maxActiveAdvances: z.number().int().min(1),
  minDaysBetweenRequests: z.number().int().min(0),
  approvalRequired: z.boolean(),
  deductionMethod: z.enum(["FULL_NEXT", "INSTALLMENT"]),
  maxInstallments: z.number().int().min(1),
});

const periodLockingSchema = z.object({
  autoLockAfterPaid: z.boolean(),
  autoLockDelayDays: z.number().int().min(0),
  requireApprovalToUnlock: z.boolean(),
  maxUnlockCount: z.number().int().min(0),
});

const payrollConfigSchema = z.object({
  bpjs: bpjsConfigSchema.optional(),
  tax: taxConfigSchema.optional(),
  overtime: overtimeConfigSchema.optional(),
  thrConfig: thrConfigSchema.optional(),
  advancePolicy: advancePolicySchema.optional(),
  periodLocking: periodLockingSchema.optional(),
});

// ============================================================================
// Handlers
// ============================================================================

/** GET /api/admin/salary/config — Get tenant payroll configuration */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  if (!(await hasPermission("salary:read"))) {
    return ApiErrors.forbidden(
      "Anda tidak memiliki akses untuk melihat konfigurasi payroll",
    );
  }

  const tenantId = ctx.session!.user.tenantId!;
  const config = getPayrollConfig(tenantId);

  return apiSuccess(config);
});

/** PUT /api/admin/salary/config — Update tenant payroll configuration */
export const PUT = createHandler(
  { auth: true, schema: payrollConfigSchema },
  async (_req, ctx) => {
    if (!(await hasPermission("salary:manage"))) {
      return ApiErrors.forbidden(
        "Anda tidak memiliki akses untuk mengubah konfigurasi payroll",
      );
    }

    const tenantId = ctx.session!.user.tenantId!;
    const updated = savePayrollConfig(
      tenantId,
      ctx.validated as unknown as Partial<TenantPayrollConfig>,
    );

    return apiSuccess(updated);
  },
);
