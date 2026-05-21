import type { PayrollEntryStatus, EmployeeType, TaxMethod } from "../enums";

export interface PayrollEntry {
  id: string;
  payrollRunId: string;
  tenantId: string;
  userId: string;
  employeeType: EmployeeType;
  taxMethod: TaxMethod;
  basicSalary: number;
  effectiveSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  totalTax: number;
  netSalary: number;
  employerCost: number;
  status: PayrollEntryStatus;
  errorMessage: string | null;
  calculatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
