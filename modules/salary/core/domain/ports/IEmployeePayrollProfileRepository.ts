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
}
