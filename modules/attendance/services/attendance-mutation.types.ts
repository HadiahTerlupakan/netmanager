import type { Prisma } from "@prisma/client";
import type { AttendanceStatus } from "../types/attendance.enums";
import type { AttendanceEvaluationResult } from "../types/AttendanceEvaluation";
import type { CachedUserAttendanceSettings } from "./attendance-service-helpers";

export type CheckoutParams = {
  userId: string;
  photoUrl: string | null;
  location: string | null;
  notes?: string;
  latitude?: number;
  longitude?: number;
  offlineTime?: Date;
  tenantId?: string;
};

export type CheckoutResult = {
  attendance: Prisma.AttendanceGetPayload<{ include: { user: true } }>;
  evaluation: AttendanceEvaluationResult;
  warning?: string;
};

export type CheckInContext = {
  checkInTime: Date;
  effectiveToday: Date;
  tenantId?: string;
};

export type CheckInEvaluationContext = {
  timezone: string;
  userDetails: CachedUserAttendanceSettings | null;
};

export type MutationGeofence = {
  status: string;
  distance: number | null;
  siteName?: string | null;
};

export type EvaluationAttendance = {
  tenantId: string | null;
  userId: string;
  checkIn: Date;
  checkOut: Date | null;
  status: AttendanceStatus;
};

export type CheckoutSourceAttendance = {
  id: string;
  notes: string | null;
  status: AttendanceStatus;
};

export type CheckoutWarningAttendance = {
  checkIn: Date;
  user: {
    workingHourMode?: string | null;
    flexibleTargetHour?: number | null;
  };
};
