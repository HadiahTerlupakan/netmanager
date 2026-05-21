import type {
  IPayrollCalculator,
  CalculationContext,
  CalculationResult,
  PayrollLine,
} from "@/modules/salary/core";

/**
 * Pipeline orchestrator that executes payroll calculators in order,
 * passing accumulated lines from previous calculators to subsequent ones.
 */
export class PayrollCalculationEngine {
  private calculators: IPayrollCalculator[];

  constructor(calculators: IPayrollCalculator[]) {
    this.calculators = [...calculators].sort((a, b) => a.order - b.order);
  }

  calculate(ctx: CalculationContext): {
    lines: PayrollLine[];
    metadata: Record<string, unknown>;
  } {
    let accumulatedLines: PayrollLine[] = [...ctx.previousLines];
    let accumulatedMetadata: Record<string, unknown> = { ...ctx.metadata };

    for (const calculator of this.calculators) {
      if (
        calculator.applicableTo !== null &&
        !calculator.applicableTo.includes(ctx.employee.employeeType)
      ) {
        continue;
      }

      const calcCtx: CalculationContext = {
        ...ctx,
        previousLines: accumulatedLines,
        metadata: accumulatedMetadata,
      };

      const result: CalculationResult = calculator.calculate(calcCtx);
      accumulatedLines = [...accumulatedLines, ...result.lines];

      if (result.metadata) {
        accumulatedMetadata = { ...accumulatedMetadata, ...result.metadata };
      }
    }

    const newLines = accumulatedLines.slice(ctx.previousLines.length);
    return { lines: newLines, metadata: accumulatedMetadata };
  }
}
