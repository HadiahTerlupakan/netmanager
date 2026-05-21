import { describe, it, expect } from "vitest";
import { TaxCalculatorV2 } from "@/modules/salary-v2/tax/TaxCalculatorV2";
import { InMemoryTaxHistoryProvider } from "@/modules/salary-v2/tax/providers/TaxHistoryProvider";
import type { MonthlyTaxRecord } from "@/modules/salary-v2/tax/providers/TaxHistoryProvider";
import { createTestContext } from "@/modules/salary-v2/calculation/helpers/context-helpers";
import { buildLine } from "@/modules/salary-v2/calculation/helpers/line-builder";
import { ComponentCategory } from "@/modules/salary-v2/core";
import type { TerBracket } from "@/modules/salary-v2/core";

const TER_BRACKETS: TerBracket[] = [
  { ptkpGroup: "A", minIncome: 0, maxIncome: 5400000, rate: 0 },
  { ptkpGroup: "A", minIncome: 5400000, maxIncome: 5650000, rate: 0.0025 },
  { ptkpGroup: "A", minIncome: 5650000, maxIncome: 5950000, rate: 0.005 },
  { ptkpGroup: "A", minIncome: 5950000, maxIncome: 6300000, rate: 0.0075 },
  { ptkpGroup: "A", minIncome: 6300000, maxIncome: 6750000, rate: 0.01 },
  { ptkpGroup: "A", minIncome: 6750000, maxIncome: 7500000, rate: 0.0125 },
  { ptkpGroup: "A", minIncome: 7500000, maxIncome: 8550000, rate: 0.015 },
  { ptkpGroup: "A", minIncome: 8550000, maxIncome: 9650000, rate: 0.0175 },
  { ptkpGroup: "A", minIncome: 9650000, maxIncome: 10050000, rate: 0.02 },
  { ptkpGroup: "A", minIncome: 10050000, maxIncome: 10350000, rate: 0.0225 },
  { ptkpGroup: "A", minIncome: 10350000, maxIncome: 10700000, rate: 0.025 },
  { ptkpGroup: "A", minIncome: 10700000, maxIncome: 11050000, rate: 0.03 },
  { ptkpGroup: "A", minIncome: 11050000, maxIncome: null, rate: 0.035 },
];

describe("TaxCalculatorV2", () => {
  describe("Monthly TER calculation", () => {
    it("should use TER brackets when available", () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji",
          category: ComponentCategory.EARNING,
          amount: 10000000,
        }),
      ];
      const ctx = createTestContext({
        employee: {
          ...createTestContext().employee,
          taxMethod: "NET",
          ptkpStatus: "TK_0",
          basicSalary: 10000000,
        },
        previousLines,
        metadata: {
          effectiveSalary: 10000000,
          currentMonth: 6,
          currentYear: 2026,
        },
      });
      ctx.config.tax.terBrackets = TER_BRACKETS;

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find((l) => l.componentCode === "PPH21");

      expect(pph21?.amount).toBe(Math.floor(10000000 * 0.02));
    });

    it("should fallback to progressive if no TER brackets", () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji",
          category: ComponentCategory.EARNING,
          amount: 10000000,
        }),
      ];
      const ctx = createTestContext({
        employee: {
          ...createTestContext().employee,
          taxMethod: "NET",
          ptkpStatus: "TK_0",
          basicSalary: 10000000,
        },
        previousLines,
        metadata: {
          effectiveSalary: 10000000,
          currentMonth: 6,
          currentYear: 2026,
        },
      });
      ctx.config.tax.terBrackets = [];

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find((l) => l.componentCode === "PPH21");
      expect(pph21?.amount).toBeGreaterThan(0);
    });
  });

  describe("Annual correction (December)", () => {
    it("should apply annual correction in December", () => {
      const records: MonthlyTaxRecord[] = Array.from(
        { length: 11 },
        (_, i) => ({
          userId: "user-1",
          year: 2026,
          month: i + 1,
          grossIncome: 10000000,
          taxPaid: 200000,
          biayaJabatan: 500000,
          bpjsEmployee: 320000,
        }),
      );
      const provider = new InMemoryTaxHistoryProvider(records);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji",
          category: ComponentCategory.EARNING,
          amount: 10000000,
        }),
        buildLine({
          componentCode: "BPJS_JHT_EE",
          componentName: "BPJS",
          category: ComponentCategory.DEDUCTION,
          amount: 200000,
        }),
      ];
      const ctx = createTestContext({
        employee: {
          ...createTestContext().employee,
          taxMethod: "NET",
          ptkpStatus: "TK_0",
          npwp: "12.345",
          basicSalary: 10000000,
        },
        previousLines,
        metadata: {
          effectiveSalary: 10000000,
          currentMonth: 12,
          currentYear: 2026,
        },
      });

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find((l) => l.componentCode === "PPH21");

      expect(pph21).toBeDefined();
      expect(result.metadata?.isAnnualCorrection).toBe(true);
    });
  });

  describe("Gross-up iterative", () => {
    it("should use iterative gross-up for GROSS_UP method", () => {
      const provider = new InMemoryTaxHistoryProvider([]);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji",
          category: ComponentCategory.EARNING,
          amount: 15000000,
        }),
      ];
      const ctx = createTestContext({
        employee: {
          ...createTestContext().employee,
          taxMethod: "GROSS_UP",
          ptkpStatus: "TK_0",
          basicSalary: 15000000,
        },
        previousLines,
        metadata: {
          effectiveSalary: 15000000,
          currentMonth: 6,
          currentYear: 2026,
        },
      });

      const result = calculator.calculate(ctx);
      const taxAllowance = result.lines.find(
        (l) => l.componentCode === "TAX_ALLOWANCE",
      );
      const pph21 = result.lines.find((l) => l.componentCode === "PPH21");

      expect(taxAllowance).toBeDefined();
      expect(pph21).toBeDefined();
      expect(taxAllowance?.amount).toBe(pph21?.amount);
      expect(result.metadata?.grossUpConverged).toBe(true);
    });
  });

  describe("Resign mid-year", () => {
    it("should calculate final tax on resign", () => {
      const records: MonthlyTaxRecord[] = Array.from({ length: 7 }, (_, i) => ({
        userId: "user-1",
        year: 2026,
        month: i + 1,
        grossIncome: 10000000,
        taxPaid: 200000,
        biayaJabatan: 500000,
        bpjsEmployee: 320000,
      }));
      const provider = new InMemoryTaxHistoryProvider(records);
      const calculator = new TaxCalculatorV2(provider);

      const previousLines = [
        buildLine({
          componentCode: "BASIC_SALARY",
          componentName: "Gaji",
          category: ComponentCategory.EARNING,
          amount: 10000000,
        }),
        buildLine({
          componentCode: "BPJS_JHT_EE",
          componentName: "BPJS",
          category: ComponentCategory.DEDUCTION,
          amount: 200000,
        }),
      ];
      const ctx = createTestContext({
        employee: {
          ...createTestContext().employee,
          taxMethod: "NET",
          ptkpStatus: "TK_0",
          npwp: "12.345",
          basicSalary: 10000000,
        },
        previousLines,
        metadata: {
          effectiveSalary: 10000000,
          currentMonth: 8,
          currentYear: 2026,
          isResign: true,
        },
      });

      const result = calculator.calculate(ctx);
      const pph21 = result.lines.find((l) => l.componentCode === "PPH21");

      expect(pph21).toBeDefined();
      expect(result.metadata?.isAnnualCorrection).toBe(true);
    });
  });
});
