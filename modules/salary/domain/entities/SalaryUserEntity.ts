import type { EmployeeType, PtkpStatus, RateType } from "./SalaryEntity";
import type { UserSalaryComponentWithComponentEntity } from "./SalaryComponentEntity";

export interface SalaryUserConfigEntity {
  id: string;
  name: string | null;
  basicSalary: number | null;
  employeeType: EmployeeType;
  departmentId: string | null;
  siteId: string | null;
  payPeriodDay: number | null;
  payDay: number | null;
  woIncentiveEnabled: boolean;
  woIncentiveRate: number | null;
  lateDeductionRate: number | null;
  absentDeductionRate: number | null;
  overtimeRateNormal: number | null;
  overtimeRateHoliday: number | null;
  overtimeRateNational: number | null;
  overtimeCalcTypeNormal: RateType | null;
  overtimeCalcTypeHoliday: RateType | null;
  overtimeCalcTypeNational: RateType | null;
  workDays: string | null;
  joinDate: Date | null;
  ptkpStatus: PtkpStatus | null;
  bpjsKesehatan: boolean;
  bpjsKetenagakerjaan: boolean;
}

export interface SalaryUserListEntity {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  basicSalary: number | null;
  overtimeRateNormal?: number | null;
  overtimeCalcTypeNormal?: RateType | null;
  overtimeRateHoliday?: number | null;
  overtimeCalcTypeHoliday?: RateType | null;
  overtimeRateNational?: number | null;
  overtimeCalcTypeNational?: RateType | null;
  woIncentiveRate?: number | null;
  lateDeductionRate?: number | null;
  absentDeductionRate?: number | null;
  joinDate?: Date | null;
  ptkpStatus?: PtkpStatus | null;
  bpjsKesehatan?: boolean;
  bpjsKetenagakerjaan?: boolean;
  departments?: { name: string } | null;
  role?: { name: string } | null;
}

export interface SalaryUserDetailEntity extends SalaryUserListEntity {
  image?: string | null;
  userSalaryComponents?: UserSalaryComponentWithComponentEntity[];
}

export interface SalaryUserWorkDaysEntity {
  workDays: string | null;
}
