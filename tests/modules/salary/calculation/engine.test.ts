import { describe, it, expect } from "vitest";
import { PayrollCalculationEngine } from "@/modules/salary/calculation/engine/PayrollCalculationEngine";
import { createTestContext } from "@/modules/salary/calculation/helpers/context-helpers";
import { buildLine } from "@/modules/salary/calculation/helpers/line-builder";
import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
} from "@/modules/salary/core";
import { ComponentCategory, type EmployeeType } from "@/modules/salary/core";

class MockCalculatorA implements IPayrollCalculator {
  name = "MockA";
  order = 1;
  applicableTo: EmployeeType[] | null = null;
  calculate(_ctx: CalculationContext): CalculationResult {
    return {
      lines: [
        buildLine({
          componentCode: "MOCK_A",
          componentName: "Mock A",
          category: ComponentCategory.EARNING,
          amount: 1000000,
        }),
      ],
    };
  }
}

class MockCalculatorB implements IPayrollCalculator {
  name = "MockB";
  order = 2;
  applicableTo: EmployeeType[] | null = null;
  calculate(ctx: CalculationContext): CalculationResult {
    const prevTotal = ctx.previousLines.reduce((sum, l) => sum + l.amount, 0);
    return {
      lines: [
        buildLine({
          componentCode: "MOCK_B",
          componentName: "Mock B",
          category: ComponentCategory.DEDUCTION,
          amount: Math.floor(prevTotal * 0.1),
        }),
      ],
    };
  }
}

describe("PayrollCalculationEngine", () => {
  it("should execute calculators in order", () => {
    const engine = new PayrollCalculationEngine([
      new MockCalculatorA(),
      new MockCalculatorB(),
    ]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);

    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].componentCode).toBe("MOCK_A");
    expect(result.lines[0].amount).toBe(1000000);
    expect(result.lines[1].componentCode).toBe("MOCK_B");
    expect(result.lines[1].amount).toBe(100000);
  });

  it("should pass accumulated lines to subsequent calculators", () => {
    const engine = new PayrollCalculationEngine([
      new MockCalculatorA(),
      new MockCalculatorB(),
    ]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.lines[1].amount).toBe(100000);
  });

  it("should sort calculators by order regardless of registration order", () => {
    const engine = new PayrollCalculationEngine([
      new MockCalculatorB(),
      new MockCalculatorA(),
    ]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.lines[0].componentCode).toBe("MOCK_A");
    expect(result.lines[1].componentCode).toBe("MOCK_B");
  });

  it("should skip calculator if employee type not in applicableTo", () => {
    class PkwttOnly implements IPayrollCalculator {
      name = "PkwttOnly";
      order = 1;
      applicableTo = ["PKWTT" as const];
      calculate(): CalculationResult {
        return {
          lines: [
            buildLine({
              componentCode: "PKWTT_ONLY",
              componentName: "PKWTT Only",
              category: ComponentCategory.EARNING,
              amount: 500000,
            }),
          ],
        };
      }
    }

    const engine = new PayrollCalculationEngine([new PkwttOnly()]);

    const pkwttCtx = createTestContext({
      employee: { ...createTestContext().employee, employeeType: "PKWTT" },
    });
    expect(engine.calculate(pkwttCtx).lines).toHaveLength(1);

    const dailyCtx = createTestContext({
      employee: { ...createTestContext().employee, employeeType: "DAILY" },
    });
    expect(engine.calculate(dailyCtx).lines).toHaveLength(0);
  });

  it("should return empty lines for empty calculator list", () => {
    const engine = new PayrollCalculationEngine([]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.lines).toHaveLength(0);
  });

  it("should merge metadata from all calculators", () => {
    class MetaCalc implements IPayrollCalculator {
      name = "MetaCalc";
      order = 1;
      applicableTo: EmployeeType[] | null = null;
      calculate(): CalculationResult {
        return { lines: [], metadata: { workDays: 22 } };
      }
    }

    const engine = new PayrollCalculationEngine([new MetaCalc()]);
    const ctx = createTestContext();
    const result = engine.calculate(ctx);
    expect(result.metadata.workDays).toBe(22);
  });
});
