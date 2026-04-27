export type SalaryStatus =
  | "DRAFT"
  | "CALCULATED"
  | "AUDITED"
  | "APPROVED"
  | "PAID"
  | "REVISED";

export type SalaryComponentType = "EARNING" | "DEDUCTION";

export type RateType = "FIXED" | "PER_HOUR" | "PERCENTAGE" | "DAILY_SALARY";

export type EmployeeType = string;

export type PtkpStatus =
  | "TK_0"
  | "TK_1"
  | "TK_2"
  | "TK_3"
  | "K_0"
  | "K_1"
  | "K_2"
  | "K_3"
  | "KI_0"
  | "KI_1"
  | "KI_2"
  | "KI_3";

export interface SalaryUserSummaryEntity {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  departmentId: string | null;
  siteId: string | null;
  departments?: { name: string } | null;
  sites?: { name: string } | null;
}

export interface SalaryActorEntity {
  id: string;
  name: string | null;
}

export interface SalaryDetailEntity {
  id: string;
  salaryId: string;
  name: string;
  type: SalaryComponentType;
  quantity: number | null;
  rate: number | null;
  amount: number;
  notes: string | null;
  loanPaymentId?: string | null;
}

export interface SalaryRevisionEntity {
  id: string;
  salaryId: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  revisedById: string;
  createdAt: Date;
}

export interface SalaryEntity {
  id: string;
  userId: string;
  month: number;
  year: number;
  status: SalaryStatus;
  basicSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  auditNotes: string | null;
  calculatedAt: Date | null;
  auditedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalaryWithDetailsEntity extends SalaryEntity {
  user: SalaryUserSummaryEntity;
  details: SalaryDetailEntity[];
  revisions?: SalaryRevisionEntity[];
  auditedBy?: SalaryActorEntity | null;
  approvedBy?: SalaryActorEntity | null;
}

export interface SalaryPeriodStatsEntity {
  total: number;
  draft: number;
  calculated: number;
  audited: number;
  approved: number;
  paid: number;
  totalNetSalary: number;
}
