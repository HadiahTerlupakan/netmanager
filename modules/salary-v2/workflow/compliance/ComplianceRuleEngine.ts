import type {
  PayrollEntry,
  RegionalMinimumWage,
  ComplianceSeverity,
  BpjsEnrollment,
} from "@/modules/salary-v2/core";

// --- Types ---

/** Context provided to each compliance rule check */
export interface ComplianceCheckContext {
  entry: PayrollEntry;
  profile: {
    userId: string;
    regionCode: string;
    bpjsConfig: BpjsEnrollment;
    overtimeEligible: boolean;
  };
  overtimeHoursDaily: number;
  regionalWage: RegionalMinimumWage | null;
}

/** Result of a single compliance rule check */
export interface ComplianceRuleResult {
  ruleName: string;
  severity: ComplianceSeverity;
  passed: boolean;
  message: string;
  suggestion: string | null;
  affectedEntryId: string;
}

/** A compliance rule definition */
export interface ComplianceRule {
  name: string;
  severity: ComplianceSeverity;
  check(context: ComplianceCheckContext): ComplianceRuleResult;
}

/** Aggregated result of running all compliance rules */
export interface ComplianceRunResult {
  totalChecks: number;
  passed: number;
  failed: number;
  errors: ComplianceRuleResult[];
  warnings: ComplianceRuleResult[];
  hasBlockingErrors: boolean;
}

// --- Built-in Rules ---

/** Validates that net salary meets regional minimum wage */
export const UMR_CHECK: ComplianceRule = {
  name: "UMR_CHECK",
  severity: "ERROR",
  check(ctx: ComplianceCheckContext): ComplianceRuleResult {
    const { entry, regionalWage } = ctx;

    if (!regionalWage) {
      return {
        ruleName: "UMR_CHECK",
        severity: "ERROR",
        passed: false,
        message: `No regional minimum wage data found for region ${ctx.profile.regionCode}`,
        suggestion: "Configure regional minimum wage for this region",
        affectedEntryId: entry.id,
      };
    }

    const passed = entry.effectiveSalary >= regionalWage.monthlyAmount;

    return {
      ruleName: "UMR_CHECK",
      severity: "ERROR",
      passed,
      message: passed
        ? "Salary meets minimum wage requirement"
        : `Effective salary ${entry.effectiveSalary} is below UMR ${regionalWage.monthlyAmount} (${regionalWage.regionName})`,
      suggestion: passed
        ? null
        : `Increase salary to at least ${regionalWage.monthlyAmount}`,
      affectedEntryId: entry.id,
    };
  },
};

/** Validates that net salary is not negative */
export const NEGATIVE_NET_SALARY: ComplianceRule = {
  name: "NEGATIVE_NET_SALARY",
  severity: "ERROR",
  check(ctx: ComplianceCheckContext): ComplianceRuleResult {
    const { entry } = ctx;
    const passed = entry.netSalary >= 0;

    return {
      ruleName: "NEGATIVE_NET_SALARY",
      severity: "ERROR",
      passed,
      message: passed
        ? "Net salary is non-negative"
        : `Net salary is negative: ${entry.netSalary}`,
      suggestion: passed
        ? null
        : "Review deductions — total deductions exceed gross earnings",
      affectedEntryId: entry.id,
    };
  },
};

/** Warns if daily overtime exceeds legal cap (3 hours/day per Indonesian labor law) */
export const OVERTIME_DAILY_CAP: ComplianceRule = {
  name: "OVERTIME_DAILY_CAP",
  severity: "WARNING",
  check(ctx: ComplianceCheckContext): ComplianceRuleResult {
    const MAX_DAILY_OVERTIME_HOURS = 3;
    const { entry, overtimeHoursDaily } = ctx;

    if (!ctx.profile.overtimeEligible) {
      return {
        ruleName: "OVERTIME_DAILY_CAP",
        severity: "WARNING",
        passed: true,
        message: "Employee not eligible for overtime — skipped",
        suggestion: null,
        affectedEntryId: entry.id,
      };
    }

    const passed = overtimeHoursDaily <= MAX_DAILY_OVERTIME_HOURS;

    return {
      ruleName: "OVERTIME_DAILY_CAP",
      severity: "WARNING",
      passed,
      message: passed
        ? "Overtime within daily cap"
        : `Daily overtime ${overtimeHoursDaily}h exceeds cap of ${MAX_DAILY_OVERTIME_HOURS}h`,
      suggestion: passed
        ? null
        : "Review overtime records — daily overtime should not exceed 3 hours",
      affectedEntryId: entry.id,
    };
  },
};

/** Warns if employee is not enrolled in mandatory BPJS programs */
export const BPJS_ENROLLMENT: ComplianceRule = {
  name: "BPJS_ENROLLMENT",
  severity: "WARNING",
  check(ctx: ComplianceCheckContext): ComplianceRuleResult {
    const { entry, profile } = ctx;
    const { bpjsConfig } = profile;

    const missingPrograms: string[] = [];
    if (!bpjsConfig.kesehatan) missingPrograms.push("Kesehatan");
    if (!bpjsConfig.jht) missingPrograms.push("JHT");
    if (!bpjsConfig.jkk) missingPrograms.push("JKK");
    if (!bpjsConfig.jkm) missingPrograms.push("JKM");

    const passed = missingPrograms.length === 0;

    return {
      ruleName: "BPJS_ENROLLMENT",
      severity: "WARNING",
      passed,
      message: passed
        ? "All mandatory BPJS programs enrolled"
        : `Missing BPJS enrollment: ${missingPrograms.join(", ")}`,
      suggestion: passed
        ? null
        : `Enroll employee in: ${missingPrograms.join(", ")}`,
      affectedEntryId: entry.id,
    };
  },
};

// --- Engine ---

/** Runs a set of compliance rules against payroll entry contexts */
export class ComplianceRuleEngine {
  private rules: ComplianceRule[];

  constructor(rules?: ComplianceRule[]) {
    this.rules = rules ?? [
      UMR_CHECK,
      NEGATIVE_NET_SALARY,
      OVERTIME_DAILY_CAP,
      BPJS_ENROLLMENT,
    ];
  }

  /** Add a custom rule to the engine */
  addRule(rule: ComplianceRule): void {
    this.rules.push(rule);
  }

  /** Get all registered rules */
  getRules(): readonly ComplianceRule[] {
    return this.rules;
  }

  /** Run all rules against a single entry context */
  checkEntry(context: ComplianceCheckContext): ComplianceRunResult {
    const results = this.rules.map((rule) => rule.check(context));

    const errors = results.filter((r) => !r.passed && r.severity === "ERROR");
    const warnings = results.filter(
      (r) => !r.passed && r.severity === "WARNING",
    );
    const passed = results.filter((r) => r.passed).length;

    return {
      totalChecks: results.length,
      passed,
      failed: results.length - passed,
      errors,
      warnings,
      hasBlockingErrors: errors.length > 0,
    };
  }

  /** Run all rules against multiple entry contexts */
  checkAll(contexts: ComplianceCheckContext[]): ComplianceRunResult {
    const allResults: ComplianceRuleResult[] = [];

    for (const ctx of contexts) {
      for (const rule of this.rules) {
        allResults.push(rule.check(ctx));
      }
    }

    const errors = allResults.filter(
      (r) => !r.passed && r.severity === "ERROR",
    );
    const warnings = allResults.filter(
      (r) => !r.passed && r.severity === "WARNING",
    );
    const passed = allResults.filter((r) => r.passed).length;

    return {
      totalChecks: allResults.length,
      passed,
      failed: allResults.length - passed,
      errors,
      warnings,
      hasBlockingErrors: errors.length > 0,
    };
  }
}
