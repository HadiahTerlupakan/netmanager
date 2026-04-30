import type { Session } from "next-auth";

export type NewUserSiteAssignment = {
  siteId?: string;
  isPrimary?: boolean;
};

export type CreateAdminUserInput = {
  email: string;
  name?: string;
  password: string;
  phone?: string;
  roleId?: string;
  siteId?: string;
  departmentId?: string;
  isActive?: boolean;
  isSales?: boolean;
  isAttendanceRequired?: boolean;
  tenantId?: string | null;
  userSites?: Array<{ siteId: string; isPrimary?: boolean }>;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  canvasingTarget?: number;
  targetSchema?: string;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
  leaveQuotas?: Record<string, number>;
};

export type UpdateUserPayload = {
  email?: string;
  name?: string;
  password?: string;
  phone?: string;
  roleId?: string | null;
  siteId?: string | null;
  isAttendanceRequired?: boolean;
  departmentId?: string | null;
  isActive?: boolean;
  isSales?: boolean;
  tenantId?: string | null;
  userSites?: Array<{ siteId: string; isPrimary?: boolean }>;
  workingHourMode?: string;
  attendanceGeofencePolicy?: string;
  startWorkTime?: string;
  endWorkTime?: string;
  workDays?: string;
  flexibleTargetHour?: number;
  shiftId?: string | null;
  canvasingTarget?: number;
  targetSchema?: string;
  basicSalary?: number;
  payPeriodDay?: number;
  payDay?: number;
  overtimeRateNormal?: number;
  overtimeRateHoliday?: number;
  overtimeRateNational?: number;
  overtimeCalcTypeNormal?: string;
  overtimeCalcTypeHoliday?: string;
  overtimeCalcTypeNational?: string;
  woIncentiveEnabled?: boolean;
  woIncentiveRate?: number;
  lateDeductionRate?: number;
  absentDeductionRate?: number;
};

export type AdminSession = Session & {
  user: Session["user"] & {
    id: string;
    isSuperAdmin?: boolean;
  };
};

export type UserRouteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: number; message: string } };
