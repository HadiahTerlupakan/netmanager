import type {
  EmployeePayrollProfile,
  EmployeeComponent,
} from "../entities/EmployeePayrollProfile";
import type { EmployeeType } from "../enums";

export interface ProfileFilter {
  tenantId: string;
  employeeType?: EmployeeType;
  payScheduleId?: string;
  departmentId?: string;
  siteId?: string;
  isActive?: boolean;
}

/** Salary config fields stored on the User table */
export interface UserSalaryConfig {
  payPeriodDay?: number;
  payDay?: number;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
}

export interface IEmployeePayrollProfileRepository {
  findByUserId(
    userId: string,
    tenantId: string,
  ): Promise<EmployeePayrollProfile | null>;
  findAll(filter: ProfileFilter): Promise<EmployeePayrollProfile[]>;
  create(data: EmployeePayrollProfile): Promise<EmployeePayrollProfile>;
  update(
    userId: string,
    tenantId: string,
    data: Partial<EmployeePayrollProfile>,
  ): Promise<EmployeePayrollProfile>;
  assignComponent(
    userId: string,
    tenantId: string,
    component: EmployeeComponent,
  ): Promise<void>;
  removeComponent(
    userId: string,
    tenantId: string,
    componentId: string,
  ): Promise<void>;
  updateComponent(
    userId: string,
    tenantId: string,
    componentId: string,
    data: Partial<EmployeeComponent>,
  ): Promise<void>;
  /** Get salary config fields from User table for multiple users */
  getUserSalaryConfigs(
    userIds: string[],
  ): Promise<Map<string, UserSalaryConfig>>;
  /** Update salary config fields on the User table */
  updateUserSalaryConfig(
    userId: string,
    config: UserSalaryConfig,
  ): Promise<void>;
}
