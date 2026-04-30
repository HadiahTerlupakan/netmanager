import type { Prisma } from "@prisma/client";

export type AdminAttendanceUser = {
  id: string;
  workingHourMode?: string | null;
  startWorkTime?: string | null;
  shift?: { startTime?: string | null } | null;
};

export type SessionUser = {
  id: string;
  isSuperAdmin?: boolean;
};

export type DetailResult<T> =
  | { type: "success"; data: T; message?: string }
  | { type: "notFound"; message: string }
  | { type: "badRequest"; message: string };

export type RestrictedScope = {
  siteId: string | null | undefined;
  departmentId: string | null | undefined;
} | null;

export type AttendanceUpdateInput = Prisma.AttendanceUpdateInput;
