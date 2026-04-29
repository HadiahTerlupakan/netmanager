import type { AttendanceIdempotencyService } from "./AttendanceIdempotencyService";
import type { AttendancePhotoService } from "./AttendancePhotoService";
import type { AttendanceService } from "./AttendanceService";
import type { AttendanceTimezoneService } from "./AttendanceTimezoneService";
import type { ErrorCode } from "@/lib/api";

export interface MobileCheckInUser {
  id: string;
  tenantId?: string | null;
}

export interface MobileCheckInRouteInput {
  request: Request;
  user: MobileCheckInUser;
}

export interface MobileCheckInParsedPayload {
  location: string;
  notes: string;
  bodyRequestId?: string;
  latitude?: number;
  longitude?: number;
  photoUrl: string | null;
  offlineCapturedAt?: Date;
}

export interface MobileAttendanceCheckInDependencies {
  attendance?: Pick<AttendanceService, "checkIn">;
  idempotency?: Pick<
    AttendanceIdempotencyService,
    | "resolveRequestId"
    | "buildPayloadHash"
    | "begin"
    | "getReplay"
    | "complete"
    | "release"
  >;
  timezone?: Pick<AttendanceTimezoneService, "getTimezone">;
  photo?: Pick<AttendancePhotoService, "processPhoto">;
}

export type MobileAttendanceCheckInRouteSuccess = {
  success: true;
  data: unknown;
  idempotentReplay?: boolean;
};

export type MobileAttendanceCheckInRouteFailure = {
  success: false;
  status: number;
  code: ErrorCode;
  error: string;
  details?: Record<string, unknown>;
};

export type ParsedPayloadResult =
  | { success: true; data: MobileCheckInParsedPayload }
  | MobileAttendanceCheckInRouteFailure;

export type MobileAttendanceCheckInRouteResult =
  | MobileAttendanceCheckInRouteSuccess
  | MobileAttendanceCheckInRouteFailure;
