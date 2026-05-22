import type {
  EmployeeType,
  TaxMethod,
  ComponentCategory,
  ComponentCalculationType,
} from "../enums";
import type { PtkpCategory } from "../value-objects/PtkpStatus";

export interface BpjsEnrollment {
  kesehatan: boolean;
  jht: boolean;
  jp: boolean;
  jkk: boolean;
  jkm: boolean;
}

export interface EmployeeComponent {
  componentId: string;
  componentCode: string;
  componentName: string;
  category: ComponentCategory;
  calculationType: ComponentCalculationType;
  amount: number | null;
  isActive: boolean;
}

export interface EmployeePayrollProfile {
  id: string;
  userId: string;
  tenantId: string;
  employeeType: EmployeeType;
  taxMethod: TaxMethod;
  payScheduleId: string;
  basicSalary: number;
  payPeriodDay: number;
  ptkpStatus: PtkpCategory;
  npwp: string | null;
  bpjsConfig: BpjsEnrollment;
  regionCode: string;
  contractStart: Date;
  contractEnd: Date | null;
  overtimeEligible: boolean;
  thrEligible: boolean;
  isActive: boolean;
  components: EmployeeComponent[];
}
