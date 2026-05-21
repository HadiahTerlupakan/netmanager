import { describe, it, expect } from "vitest";
import { TerMonthlyStrategy } from "@/modules/salary/tax/strategies/TerMonthlyStrategy";
import type { TerBracket } from "@/modules/salary/core";

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
  { ptkpGroup: "B", minIncome: 0, maxIncome: 6200000, rate: 0 },
  { ptkpGroup: "B", minIncome: 6200000, maxIncome: 6500000, rate: 0.0025 },
  { ptkpGroup: "B", minIncome: 6500000, maxIncome: null, rate: 0.03 },
  { ptkpGroup: "C", minIncome: 0, maxIncome: 6600000, rate: 0 },
  { ptkpGroup: "C", minIncome: 6600000, maxIncome: 6950000, rate: 0.0025 },
  { ptkpGroup: "C", minIncome: 6950000, maxIncome: null, rate: 0.03 },
];

describe("TerMonthlyStrategy", () => {
  const strategy = new TerMonthlyStrategy();

  it("should return 0 tax if income is in 0% bracket", () => {
    const tax = strategy.calculate(5000000, "A", TER_BRACKETS);
    expect(tax).toBe(0);
  });

  it("should apply correct TER rate for group A", () => {
    const tax = strategy.calculate(8000000, "A", TER_BRACKETS);
    expect(tax).toBe(Math.floor(8000000 * 0.015));
  });

  it("should apply highest bracket if income exceeds all", () => {
    const tax = strategy.calculate(15000000, "A", TER_BRACKETS);
    expect(tax).toBe(Math.floor(15000000 * 0.035));
  });

  it("should use correct group for different PTKP", () => {
    const tax = strategy.calculate(6300000, "B", TER_BRACKETS);
    expect(tax).toBe(Math.floor(6300000 * 0.0025));
  });

  it("should return 0 if no matching bracket found", () => {
    const tax = strategy.calculate(5000000, "Z", TER_BRACKETS);
    expect(tax).toBe(0);
  });

  it("should map PTKP status to TER group correctly", () => {
    expect(TerMonthlyStrategy.getPtkpGroup("TK_0")).toBe("A");
    expect(TerMonthlyStrategy.getPtkpGroup("TK_1")).toBe("A");
    expect(TerMonthlyStrategy.getPtkpGroup("K_0")).toBe("A");
    expect(TerMonthlyStrategy.getPtkpGroup("TK_2")).toBe("B");
    expect(TerMonthlyStrategy.getPtkpGroup("TK_3")).toBe("B");
    expect(TerMonthlyStrategy.getPtkpGroup("K_1")).toBe("B");
    expect(TerMonthlyStrategy.getPtkpGroup("K_2")).toBe("B");
    expect(TerMonthlyStrategy.getPtkpGroup("K_3")).toBe("C");
  });
});
