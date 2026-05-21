import type { ComponentCategory } from "../enums";

export interface PayrollLine {
  id: string;
  entryId: string;
  tenantId: string;
  componentId: string | null;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  quantity: number;
  rate: number;
  amount: number;
  formula: string | null;
  metadata: Record<string, unknown> | null;
  sortOrder: number;
}
