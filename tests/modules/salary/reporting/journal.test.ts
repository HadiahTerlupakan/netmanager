import { describe, it, expect } from "vitest";
import { PayrollJournalGenerator } from "@/modules/salary/reporting/journal/PayrollJournalGenerator";
import type { JournalGeneratorConfig } from "@/modules/salary/reporting/journal/PayrollJournalGenerator";

const config: JournalGeneratorConfig = {
  defaultExpenseAccountId: "acc-expense-gaji",
  defaultExpenseAccountName: "Beban Gaji",
  defaultLiabilityAccountId: "acc-hutang-bpjs",
  defaultLiabilityAccountName: "Hutang BPJS",
  bpjsExpenseAccountId: "acc-expense-bpjs",
  bpjsExpenseAccountName: "Beban BPJS Perusahaan",
  taxLiabilityAccountId: "acc-hutang-pph21",
  taxLiabilityAccountName: "Hutang PPh 21",
  salaryPayableAccountId: "acc-hutang-gaji",
  salaryPayableAccountName: "Hutang Gaji",
};

describe("PayrollJournalGenerator", () => {
  const generator = new PayrollJournalGenerator(config);

  it("should generate balanced journal entries", () => {
    // Balance: Debit = Earnings + EmployerBpjs = 60M + 3M = 63M
    // Credit = NetSalary + Tax + BpjsLiability(employee + employer) = 47M + 5M + 11M = 63M
    // NetSalary = Earnings - EmployeeDeductions - Tax = 60M - 8M - 5M = 47M
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 47_000_000,
      totalEarnings: 60_000_000,
      totalEmployerBpjs: 3_000_000,
      totalTax: 5_000_000,
      totalEmployeeDeductions: 8_000_000,
    });

    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(result.totalCredit);
  });

  it("should create correct debit lines", () => {
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 47_000_000,
      totalEarnings: 60_000_000,
      totalEmployerBpjs: 3_000_000,
      totalTax: 5_000_000,
      totalEmployeeDeductions: 8_000_000,
    });

    const debitLines = result.lines.filter((l) => l.debit > 0);
    expect(debitLines).toHaveLength(2);

    const gajiDebit = debitLines.find(
      (l) => l.accountId === "acc-expense-gaji",
    );
    expect(gajiDebit).toBeDefined();
    expect(gajiDebit!.debit).toBe(60_000_000);

    const bpjsDebit = debitLines.find(
      (l) => l.accountId === "acc-expense-bpjs",
    );
    expect(bpjsDebit).toBeDefined();
    expect(bpjsDebit!.debit).toBe(3_000_000);
  });

  it("should create correct credit lines", () => {
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 47_000_000,
      totalEarnings: 60_000_000,
      totalEmployerBpjs: 3_000_000,
      totalTax: 5_000_000,
      totalEmployeeDeductions: 8_000_000,
    });

    const creditLines = result.lines.filter((l) => l.credit > 0);
    expect(creditLines).toHaveLength(3);

    const salaryPayable = creditLines.find(
      (l) => l.accountId === "acc-hutang-gaji",
    );
    expect(salaryPayable).toBeDefined();
    expect(salaryPayable!.credit).toBe(47_000_000);

    const taxLiability = creditLines.find(
      (l) => l.accountId === "acc-hutang-pph21",
    );
    expect(taxLiability).toBeDefined();
    expect(taxLiability!.credit).toBe(5_000_000);

    const bpjsLiability = creditLines.find(
      (l) => l.accountId === "acc-hutang-bpjs",
    );
    expect(bpjsLiability).toBeDefined();
    // BPJS liability = employee deductions + employer BPJS
    expect(bpjsLiability!.credit).toBe(11_000_000);
  });

  it("should verify total debit = totalEarnings + totalEmployerBpjs", () => {
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 47_000_000,
      totalEarnings: 60_000_000,
      totalEmployerBpjs: 3_000_000,
      totalTax: 5_000_000,
      totalEmployeeDeductions: 8_000_000,
    });

    expect(result.totalDebit).toBe(63_000_000);
    expect(result.totalCredit).toBe(47_000_000 + 5_000_000 + 11_000_000);
  });

  it("should skip zero-amount lines", () => {
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 5_000_000,
      totalEarnings: 5_000_000,
      totalEmployerBpjs: 0,
      totalTax: 0,
      totalEmployeeDeductions: 0,
    });

    // Only salary expense debit + salary payable credit
    expect(result.lines).toHaveLength(2);
    expect(result.isBalanced).toBe(true);
    expect(result.totalDebit).toBe(5_000_000);
    expect(result.totalCredit).toBe(5_000_000);
  });

  it("should include metadata fields", () => {
    const result = generator.generate({
      payrollRunId: "run-abc",
      tenantId: "tenant-xyz",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 10_000_000,
      totalEarnings: 12_000_000,
      totalEmployerBpjs: 1_000_000,
      totalTax: 1_000_000,
      totalEmployeeDeductions: 2_000_000,
    });

    expect(result.payrollRunId).toBe("run-abc");
    expect(result.tenantId).toBe("tenant-xyz");
    expect(result.periodStart).toEqual(new Date("2026-05-01"));
    expect(result.periodEnd).toEqual(new Date("2026-05-31"));
  });

  it("should handle all-zero amounts", () => {
    const result = generator.generate({
      payrollRunId: "run-1",
      tenantId: "tenant-1",
      periodStart: new Date("2026-05-01"),
      periodEnd: new Date("2026-05-31"),
      totalNetSalary: 0,
      totalEarnings: 0,
      totalEmployerBpjs: 0,
      totalTax: 0,
      totalEmployeeDeductions: 0,
    });

    expect(result.lines).toHaveLength(0);
    expect(result.totalDebit).toBe(0);
    expect(result.totalCredit).toBe(0);
    expect(result.isBalanced).toBe(true);
  });
});
