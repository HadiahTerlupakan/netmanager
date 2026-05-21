export interface AccountMapping {
  lineCategory: string;
  componentCode?: string;
  debitAccountId: string | null;
  creditAccountId: string | null;
  description: string;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

export interface PayrollJournalEntry {
  payrollRunId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface JournalGeneratorConfig {
  defaultExpenseAccountId: string;
  defaultExpenseAccountName: string;
  defaultLiabilityAccountId: string;
  defaultLiabilityAccountName: string;
  bpjsExpenseAccountId: string;
  bpjsExpenseAccountName: string;
  taxLiabilityAccountId: string;
  taxLiabilityAccountName: string;
  salaryPayableAccountId: string;
  salaryPayableAccountName: string;
}

/**
 * Generates balanced accounting journal entries from payroll run totals.
 * Maps payroll categories to debit/credit accounts per tenant config.
 */
export class PayrollJournalGenerator {
  constructor(private config: JournalGeneratorConfig) {}

  generate(params: {
    payrollRunId: string;
    tenantId: string;
    periodStart: Date;
    periodEnd: Date;
    totalNetSalary: number;
    totalEarnings: number;
    totalEmployerBpjs: number;
    totalTax: number;
    totalEmployeeDeductions: number;
  }): PayrollJournalEntry {
    const {
      payrollRunId,
      tenantId,
      periodStart,
      periodEnd,
      totalNetSalary,
      totalEarnings,
      totalEmployerBpjs,
      totalTax,
      totalEmployeeDeductions,
    } = params;

    const lines: JournalLine[] = [];

    // Debit: Beban Gaji
    if (totalEarnings > 0) {
      lines.push({
        accountId: this.config.defaultExpenseAccountId,
        accountName: this.config.defaultExpenseAccountName,
        debit: totalEarnings,
        credit: 0,
        description: "Beban gaji karyawan",
      });
    }

    // Debit: Beban BPJS Employer
    if (totalEmployerBpjs > 0) {
      lines.push({
        accountId: this.config.bpjsExpenseAccountId,
        accountName: this.config.bpjsExpenseAccountName,
        debit: totalEmployerBpjs,
        credit: 0,
        description: "Beban BPJS perusahaan",
      });
    }

    // Credit: Hutang Gaji (net salary)
    if (totalNetSalary > 0) {
      lines.push({
        accountId: this.config.salaryPayableAccountId,
        accountName: this.config.salaryPayableAccountName,
        debit: 0,
        credit: totalNetSalary,
        description: "Hutang gaji karyawan",
      });
    }

    // Credit: Hutang PPh 21
    if (totalTax > 0) {
      lines.push({
        accountId: this.config.taxLiabilityAccountId,
        accountName: this.config.taxLiabilityAccountName,
        debit: 0,
        credit: totalTax,
        description: "Hutang PPh 21",
      });
    }

    // Credit: Hutang BPJS (karyawan + perusahaan)
    const totalBpjsLiability = totalEmployeeDeductions + totalEmployerBpjs;
    if (totalBpjsLiability > 0) {
      lines.push({
        accountId: this.config.defaultLiabilityAccountId,
        accountName: this.config.defaultLiabilityAccountName,
        debit: 0,
        credit: totalBpjsLiability,
        description: "Hutang BPJS (karyawan + perusahaan)",
      });
    }

    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    return {
      payrollRunId,
      tenantId,
      periodStart,
      periodEnd,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: totalDebit === totalCredit,
    };
  }
}
