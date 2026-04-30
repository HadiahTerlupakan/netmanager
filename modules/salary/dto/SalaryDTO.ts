/**
 * Salary DTOs (Data Transfer Objects)
 */

import type {
  SalaryStatus,
  SalaryComponentType,
  RateType,
} from "../types/salary.enums";

// ==================== Response DTOs ====================

/**
 * DTO for salary list views
 */
export interface SalaryListItemDTO {
  id: string;
  employeeName: string | null;
  employeeEmail: string;
  month: number;
  year: number;
  period: string;
  status: SalaryStatus;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
}

/**
 * DTO for salary detail views
 */
export interface SalaryDetailDTO {
  id: string;
  month: number;
  year: number;
  period: string;
  status: SalaryStatus;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  calculatedAt: string | null;
  auditedAt: string | null;
  auditNotes: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee: {
    id: string;
    name: string | null;
    email: string;
  };
  auditedBy: {
    id: string;
    name: string | null;
  } | null;
  approvedBy: {
    id: string;
    name: string | null;
  } | null;
  details: SalaryDetailItemDTO[];
}

/**
 * DTO for salary detail items (components)
 */
export interface SalaryDetailItemDTO {
  id: string;
  name: string;
  type: SalaryComponentType;
  quantity: number | null;
  rate: number | null;
  amount: number;
  notes: string | null;
}

/**
 * DTO for salary component
 */
export interface SalaryComponentDTO {
  id: string;
  name: string;
  type: SalaryComponentType;
  rateType: RateType;
  defaultAmount: number | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

/**
 * DTO for salary slip (employee view)
 */
export interface SalarySlipDTO {
  id: string;
  period: string;
  employee: {
    name: string | null;
    email: string;
  };
  basicSalary: number;
  earnings: SalaryDetailItemDTO[];
  deductions: SalaryDetailItemDTO[];
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  paidAt: string | null;
}

// ==================== Request DTOs ====================

/**
 * DTO for generating salary
 */
export interface GenerateSalaryDTO {
  userId: string;
  month: number;
  year: number;
}

/**
 * DTO for updating salary
 */
export interface UpdateSalaryDTO {
  status?: SalaryStatus;
  auditNotes?: string;
}
