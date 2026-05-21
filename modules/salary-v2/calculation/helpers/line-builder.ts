import type { PayrollLine } from "@/modules/salary-v2/core";
import { ComponentCategory } from "@/modules/salary-v2/core";

let lineCounter = 0;

/**
 * Build a PayrollLine with sensible defaults for optional fields.
 */
export function buildLine(params: {
  entryId?: string;
  tenantId?: string;
  componentId?: string | null;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  quantity?: number;
  rate?: number;
  amount: number;
  formula?: string | null;
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
}): PayrollLine {
  lineCounter++;
  return {
    id: `line-${Date.now()}-${lineCounter}`,
    entryId: params.entryId ?? "",
    tenantId: params.tenantId ?? "",
    componentId: params.componentId ?? null,
    componentCode: params.componentCode,
    componentName: params.componentName,
    category: params.category,
    quantity: params.quantity ?? 1,
    rate: params.rate ?? params.amount,
    amount: params.amount,
    formula: params.formula ?? null,
    metadata: params.metadata ?? null,
    sortOrder: params.sortOrder ?? 0,
  };
}

/** Sum amounts of lines matching a specific category. */
export function sumLinesByCategory(
  lines: PayrollLine[],
  category: ComponentCategory,
): number {
  return lines
    .filter((l) => l.category === category)
    .reduce((sum, l) => sum + l.amount, 0);
}

/** Sum all EARNING lines. */
export function sumEarnings(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.EARNING);
}

/** Sum all DEDUCTION lines. */
export function sumDeductions(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.DEDUCTION);
}

/** Sum all TAX lines. */
export function sumTax(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.TAX);
}

/** Sum all EMPLOYER_COST lines. */
export function sumEmployerCost(lines: PayrollLine[]): number {
  return sumLinesByCategory(lines, ComponentCategory.EMPLOYER_COST);
}
