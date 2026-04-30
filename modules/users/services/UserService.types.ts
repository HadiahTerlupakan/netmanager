export interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
  phone?: string;
  departmentId?: string;
  siteId?: string;
  roleId?: string;
  isActive?: boolean;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  isSales?: boolean;
  canvasingTarget?: number;
  targetSchema?: string;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  basicSalary?: number;
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

export interface UpdateUserInput {
  email?: string;
  name?: string;
  phone?: string;
  departmentId?: string | null;
  siteId?: string | null;
  roleId?: string | null;
  isActive?: boolean;
  tenantId?: string | null;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
  isSales?: boolean;
  canvasingTarget?: number;
  targetSchema?: string;
  isAttendanceRequired?: boolean;
  basicSalary?: number;
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

export interface UserListResultDTO {
  data: import("../dto/UserDTO").UserListItemDTO[];
  total: number;
  active: number;
  inactive: number;
}
