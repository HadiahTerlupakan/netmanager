import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../entities/SalaryEntity";
import type {
  SalaryUserConfigEntity,
  SalaryUserDetailEntity,
  SalaryUserListEntity,
  SalaryUserWorkDaysEntity,
} from "../entities/SalaryUserEntity";

export interface UpdateSalaryUserConfigInput {
  basicSalary?: number | null;
  employeeType?: EmployeeType;
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
}

export interface SalaryUserFilters {
  departmentId?: string;
  siteId?: string;
  employeeType?: EmployeeType;
}

export interface ISalaryUserRepository {
  /** Get salary user list with payroll configuration. */
  findSalaryUsers(): Promise<SalaryUserListEntity[]>;

  /** Get active users for salary onboarding list. */
  findAllActiveUsersForSalaryList(): Promise<SalaryUserListEntity[]>;

  /** Get salary user detail by ID. */
  findSalaryUserById(userId: string): Promise<SalaryUserDetailEntity | null>;

  /** Update salary-related user configuration. */
  updateSalaryConfig(
    userId: string,
    data: UpdateSalaryUserConfigInput,
  ): Promise<void>;

  /** Get one user salary configuration. */
  findSalaryConfigById(userId: string): Promise<SalaryUserConfigEntity | null>;

  /** Get active users with salary configuration. */
  findManyActiveWithSalaryConfig(
    filters?: SalaryUserFilters,
  ): Promise<SalaryUserConfigEntity[]>;

  /** Get work day configuration for one user. */
  findWorkDaysConfig(userId: string): Promise<SalaryUserWorkDaysEntity | null>;
}
