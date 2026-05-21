import type { ComponentCategory, ComponentCalculationType } from "../enums";
import type { EmployeeType } from "../enums";

export interface PayrollComponent {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  category: ComponentCategory;
  calculationType: ComponentCalculationType;
  taxable: boolean;
  applicableTo: EmployeeType[];
  isStatutory: boolean;
  formula: string | null;
  defaultAmount: number | null;
  sortOrder: number;
  isActive: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
