export const AttendanceStatus = {
  ON_TIME: "ON_TIME",
  LATE: "LATE",
  ABSENT: "ABSENT",
  SICK: "SICK",
  PERMIT: "PERMIT",
  DAY_OFF: "DAY_OFF",
  ALPHA: "ALPHA",
  NO_CHECKOUT: "NO_CHECKOUT",
} as const;

export type AttendanceStatus =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const LeaveStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type LeaveStatus = (typeof LeaveStatus)[keyof typeof LeaveStatus];

export const LeaveType = {
  SAKIT: "SAKIT",
  CUTI: "CUTI",
  IZIN: "IZIN",
  LAINNYA: "LAINNYA",
  TUKAR_LIBUR: "TUKAR_LIBUR",
} as const;

export type LeaveType = (typeof LeaveType)[keyof typeof LeaveType];

export const WorkingHourMode = {
  FIXED: "FIXED",
  SHIFT: "SHIFT",
  FLEXIBLE: "FLEXIBLE",
} as const;

export type WorkingHourMode =
  (typeof WorkingHourMode)[keyof typeof WorkingHourMode];
