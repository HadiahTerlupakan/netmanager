export type LeaveStatusValue = "PENDING" | "APPROVED" | "REJECTED";
export type LeaveTypeValue =
  | "CUTI"
  | "SAKIT"
  | "IZIN"
  | "LAINNYA"
  | "TUKAR_LIBUR";

export interface LeaveRequesterContextEntity {
  workingHourMode: string | null;
  workDays: string | null;
  name: string | null;
  siteId: string | null;
}

export interface LeaveUserSummaryEntity {
  id: string;
  name: string | null;
  workingHourMode: string | null;
  workDays: string | null;
  tenantId: string | null;
  joinDate: Date | null;
}

export interface LeaveRequestEntity {
  id: string;
  tenantId: string | null;
  userId: string;
  type: LeaveTypeValue;
  startDate: Date;
  endDate: Date;
  replacementDate: Date | null;
  reason: string;
  status: LeaveStatusValue;
  attachmentUrl: string | null;
  rejectionReason?: string | null;
  user?: LeaveUserSummaryEntity | null;
}

export interface ActiveLeaveEntity {
  type: LeaveTypeValue;
  reason: string;
}

export interface TukarLiburDateEntity {
  startDate: Date;
  replacementDate: Date | null;
}

export interface LeaveApproverEntity {
  id: string;
  phone: string | null;
}
