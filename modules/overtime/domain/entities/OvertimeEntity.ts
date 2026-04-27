export type OvertimeStatusValue =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "IN_PROGRESS"
  | "COMPLETED";

export interface OvertimeEmployeeSnapshot {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  workDays?: string | null;
  workingHourMode?: string | null;
  siteName?: string | null;
  departmentName?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
}

export interface OvertimeApproverSnapshot {
  id: string;
  name: string | null;
}

export interface OvertimeAttendanceSnapshot {
  id: string;
  checkIn?: Date | null;
  checkOut?: Date | null;
}

export interface OvertimeEntity {
  id: string;
  userId: string;
  tenantId: string | null;
  reason: string;
  startTime: Date | null;
  endTime: Date | null;
  startPhoto: string | null;
  startLocation: string | null;
  endPhoto: string | null;
  endLocation: string | null;
  duration: number | null;
  status: OvertimeStatusValue;
  approvedBy: string | null;
  rejectionReason: string | null;
  attendanceId: string | null;
  isHolidayOvertime: boolean;
  isNationalHoliday: boolean;
  isOffDay: boolean;
  holidayDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: OvertimeEmployeeSnapshot | null;
  approver?: OvertimeApproverSnapshot | null;
  attendance?: OvertimeAttendanceSnapshot | null;
}

export interface OvertimeAutoCheckoutScheduleEntity {
  id: string;
  overtimeId: string;
  scheduledFor: Date;
  jobId: string | null;
  version: number;
  scheduleStatus: string;
  executedAt: Date | null;
  cancelledAt: Date | null;
  lastError: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface OvertimeCountByStatusEntity {
  [status: string]: number;
}

export interface OvertimeDateStatsEntity {
  date: string;
  requests: number;
  duration: number;
}

export interface OvertimeGroupedStatsEntity {
  name: string;
  requests: number;
  duration: number;
}

export interface OvertimeTopEmployeeEntity {
  user: OvertimeEmployeeSnapshot;
  totalDuration: number;
}

export interface OvertimeUserStatsEntity {
  userId: string;
  totalDuration: number;
}

export interface OvertimeRangeStatsEntity {
  totalRequests: number;
  totalDuration: number;
}
