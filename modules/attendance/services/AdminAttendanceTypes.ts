import type { AttendanceStatus } from "../types/attendance.enums";
import type { IAttendanceRepository } from "../domain/ports/IAttendanceRepository";

export type AttendanceEvaluationLookupRow = Awaited<
  ReturnType<IAttendanceRepository["findManyEvaluationLookups"]>
>[number];

export type AdminAttendanceRow = {
  tenantId: string | null;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  status: string;
  notes?: string | null;
  correctedAt?: Date | null;
  correctionReason?: string | null;
  correctionReplacementAttendanceId?: string | null;
  correctionSourceAttendanceId?: string | null;
  correctionSource?: string | null;
};

export type AdminAttendanceUser = {
  id: string;
  tenantId?: string | null;
  siteId?: string | null;
  departmentId?: string | null;
  isSuperAdmin?: boolean;
};

export type AttendanceFilterInput = {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
  userId?: string;
  siteId?: string;
  departmentId?: string;
  status?: string;
  statusDetail?: string;
  search?: string;
  export?: string;
};

export type AttendanceSummary = Record<string, number>;
export type AttendanceStatusValue = AttendanceStatus;
