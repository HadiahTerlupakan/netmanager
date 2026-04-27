export interface UserRelationEntity {
  id: string;
  name: string;
}

export interface UserSiteRelationEntity {
  id: string;
  code: string;
  name: string;
}

export interface UserSiteAssignmentEntity {
  id: string;
  siteId: string;
  isPrimary: boolean;
  site: UserSiteRelationEntity;
}

export interface UserShiftEntity {
  id: string;
  name: string;
}

export interface UserEntity {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  image: string | null;
  passwordHash?: string | null;
  emailVerified?: Date | null;
  pushToken?: string | null;
  pushTokenUpdatedAt?: Date | null;
  tokenVersion?: number;
  lastVersionCode?: number | null;
  lastVersionName?: string | null;
  lastVersionUpdate?: Date | null;
  lastLoginAt?: Date | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  bpjsKesehatan?: boolean | null;
  bpjsKetenagakerjaan?: boolean | null;
  fcmTokens?: string[];
  joinDate?: Date | null;
  ptkpStatus?: string | null;
  employeeType?: string | null;
  departmentId: string | null;
  siteId: string | null;
  roleId: string | null;
  tenantId: string | null;
  isActive: boolean;
  isSales: boolean;
  isAttendanceRequired: boolean;
  workingHourMode: string;
  attendanceGeofencePolicy: string | null;
  startWorkTime: string | null;
  endWorkTime: string | null;
  workDays: string | null;
  flexibleTargetHour: number | null;
  shiftId: string | null;
  canvasingTarget: number | null;
  targetSchema: string | null;
  basicSalary?: number | null;
  payPeriodDay?: number | null;
  payDay?: number | null;
  woIncentiveEnabled?: boolean | null;
  woIncentiveRate?: number | null;
  lateDeductionRate?: number | null;
  absentDeductionRate?: number | null;
  overtimeRateNormal?: number | null;
  overtimeRateHoliday?: number | null;
  overtimeRateNational?: number | null;
  overtimeCalcTypeNormal?: string | null;
  overtimeCalcTypeHoliday?: string | null;
  overtimeCalcTypeNational?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role?: UserRelationEntity | null;
  department?: UserRelationEntity | null;
  site?: UserSiteRelationEntity | null;
  tenant?: UserRelationEntity | null;
  shift?: UserShiftEntity | null;
  userSites?: UserSiteAssignmentEntity[];
}

export interface UserListResultEntity {
  data: UserEntity[];
  total: number;
  active: number;
  inactive: number;
}

export interface UserScheduleEntity {
  workingHourMode: string;
  startWorkTime?: string | null;
  endWorkTime?: string | null;
  workDays?: string | null;
  flexibleTargetHour?: number | null;
  shiftId?: string | null;
}
