import type {
  PayrollLine,
  PayrollEntry,
  ComponentCategory,
} from "@/modules/salary/core";

export interface PayslipEmployeeInfo {
  name: string;
  employeeId: string;
  position: string;
  department: string;
  bankAccount: string | null;
}

export interface PayslipPeriodInfo {
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
}

export interface PayslipLineItem {
  name: string;
  code: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface PayslipSummary {
  totalEarnings: number;
  totalDeductions: number;
  totalTax: number;
  netSalary: number;
  totalEmployerCost: number;
}

export interface PayslipData {
  employee: PayslipEmployeeInfo;
  period: PayslipPeriodInfo;
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  taxes: PayslipLineItem[];
  employerCosts: PayslipLineItem[];
  summary: PayslipSummary;
  generatedAt: Date;
}

/**
 * Generates structured payslip data from a PayrollEntry and its lines.
 * Groups lines by category, calculates summary, and formats for rendering.
 */
export class PayslipGenerator {
  generate(params: {
    entry: PayrollEntry;
    lines: PayrollLine[];
    employee: PayslipEmployeeInfo;
    period: PayslipPeriodInfo;
  }): PayslipData {
    const { entry, lines, employee, period } = params;

    const earnings = this.filterAndMap(lines, "EARNING");
    const deductions = this.filterAndMap(lines, "DEDUCTION");
    const taxes = this.filterAndMap(lines, "TAX");
    const employerCosts = this.filterAndMap(lines, "EMPLOYER_COST");

    return {
      employee,
      period,
      earnings,
      deductions,
      taxes,
      employerCosts,
      summary: {
        totalEarnings: entry.totalEarnings,
        totalDeductions: entry.totalDeductions,
        totalTax: entry.totalTax,
        netSalary: entry.netSalary,
        totalEmployerCost: entry.employerCost,
      },
      generatedAt: new Date(),
    };
  }

  private filterAndMap(
    lines: PayrollLine[],
    category: ComponentCategory,
  ): PayslipLineItem[] {
    return lines
      .filter((l) => l.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((l) => ({
        name: l.componentName,
        code: l.componentCode,
        quantity: l.quantity,
        rate: l.rate,
        amount: l.amount,
      }));
  }
}
