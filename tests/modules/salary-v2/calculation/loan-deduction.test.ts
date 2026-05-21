import { describe, it, expect } from "vitest";
import { LoanDeductionCalculator } from "@/modules/salary-v2/calculation/calculators/LoanDeductionCalculator";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { ComponentCategory } from "@/modules/salary-v2/core";

describe("LoanDeductionCalculator", () => {
  const calculator = new LoanDeductionCalculator();

  it("should have correct metadata", () => {
    expect(calculator.name).toBe("LoanDeduction");
    expect(calculator.order).toBe(70);
    expect(calculator.applicableTo).toBeNull();
  });

  it("should not generate lines if no active loans", () => {
    const ctx = createTestContext({ metadata: { effectiveSalary: 8000000 } });
    const result = calculator.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should deduct loan installment", () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          {
            id: "loan-1",
            name: "Pinjaman Karyawan",
            installment: 500000,
            remainingAmount: 2000000,
          },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("LOAN_loan-1");
    expect(result.lines[0].category).toBe(ComponentCategory.DEDUCTION);
    expect(result.lines[0].amount).toBe(500000);
  });

  it("should deduct min(installment, remainingAmount)", () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          {
            id: "loan-1",
            name: "Pinjaman",
            installment: 500000,
            remainingAmount: 200000,
          },
        ],
      },
    });
    const result = calculator.calculate(ctx);
    expect(result.lines[0].amount).toBe(200000);
  });

  it("should handle multiple loans", () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeLoans: [
          {
            id: "loan-1",
            name: "Pinjaman A",
            installment: 500000,
            remainingAmount: 2000000,
          },
          {
            id: "loan-2",
            name: "Pinjaman B",
            installment: 300000,
            remainingAmount: 1500000,
          },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].amount).toBe(500000);
    expect(result.lines[1].amount).toBe(300000);
  });

  it("should handle salary advance (FULL_NEXT)", () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeAdvances: [
          {
            id: "adv-1",
            amount: 2000000,
            deductionMethod: "FULL_NEXT",
            remainingAmount: 2000000,
          },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].componentCode).toBe("ADVANCE_adv-1");
    expect(result.lines[0].componentName).toBe("Potongan Kasbon");
    expect(result.lines[0].amount).toBe(2000000);
  });

  it("should handle installment-based advance", () => {
    const ctx = createTestContext({
      metadata: {
        effectiveSalary: 8000000,
        activeAdvances: [
          {
            id: "adv-1",
            amount: 3000000,
            deductionMethod: "INSTALLMENT",
            installmentCount: 3,
            remainingAmount: 2000000,
          },
        ],
      },
    });
    const result = calculator.calculate(ctx);

    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].amount).toBe(1000000);
  });
});
