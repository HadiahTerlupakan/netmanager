import { logActivitySafe } from "@/lib/logger";

import { getDateKeyInTimezone } from "./AttendanceAlertClock";

/** Nama aksi Log Aktivitas untuk fitur kehadiran. */
export const ATTENDANCE_ACTIVITY_ACTIONS = {
  CHECK_IN: "CHECK_IN",
  CHECK_OUT: "CHECK_OUT",
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  AUTO_ABSENT: "AUTO_ABSENT",
  AUTO_DAY_OFF: "AUTO_DAY_OFF",
  AUTO_CHECKOUT: "AUTO_CHECKOUT",
  AUTO_STATUS_REPAIR: "AUTO_STATUS_REPAIR",
  BACKDATE: "BACKDATE",
  RECOMPUTE: "RECOMPUTE",
} as const;

export type AttendanceActivityAction =
  (typeof ATTENDANCE_ACTIVITY_ACTIONS)[keyof typeof ATTENDANCE_ACTIVITY_ACTIONS];

/** Jenis data kehadiran yang menjadi awalan subjek log. */
export const ATTENDANCE_ACTIVITY_SUBJECTS = {
  ATTENDANCE: "Absensi",
  LEAVE: "Izin",
  LEAVE_QUOTA: "Kuota Cuti",
  ATTENDANCE_SETTINGS: "Pengaturan Absensi",
} as const;

export type AttendanceActivitySubject =
  (typeof ATTENDANCE_ACTIVITY_SUBJECTS)[keyof typeof ATTENDANCE_ACTIVITY_SUBJECTS];

/** Identitas proses otomatis yang tampil sebagai pelaku "System". */
export const ATTENDANCE_SYSTEM_ACTORS = {
  DAILY_ABSENCE: "cron:process-absence",
  FIXED_AUTO_ALPHA: "cron:fixed-auto-alpha",
  AUTO_CHECKOUT: "job:attendance-auto-checkout",
  NO_CHECKOUT_REPAIR: "script:repair-no-checkout",
} as const;

export type AttendanceActivityActor = { userId: string } | { systemId: string };

const DEFAULT_ATTENDANCE_TIMEZONE = "Asia/Jakarta";

/** Format tanggal kehadiran `YYYY-MM-DD` menurut zona waktu tenant. */
export function formatAttendanceDate(
  date: Date,
  timeZone: string = DEFAULT_ATTENDANCE_TIMEZONE,
): string {
  return getDateKeyInTimezone(date, timeZone);
}

/**
 * Catat aktivitas kehadiran dengan subjek `<jenis> <referensi>`. Proses
 * otomatis dicatat dengan pelaku bertipe sistem dan wajib membawa tenantId.
 */
export function recordAttendanceActivity(input: {
  action: AttendanceActivityAction;
  subject: AttendanceActivitySubject;
  reference: string;
  actor: AttendanceActivityActor;
  tenantId?: string | null;
  details?: Record<string, unknown>;
}): void {
  const actor =
    "systemId" in input.actor
      ? { actor: { type: "system", id: input.actor.systemId } }
      : { userId: input.actor.userId };
  logActivitySafe({
    action: input.action,
    subject: `${input.subject} ${input.reference}`,
    ...actor,
    tenantId: input.tenantId ?? undefined,
    details: input.details,
  });
}

/**
 * Catat perubahan absensi oleh proses otomatis. Subjek memuat nama karyawan
 * dan tanggal karena pelakunya tampil sebagai "System".
 */
export function recordAutomaticAttendance(input: {
  action: AttendanceActivityAction;
  systemId: string;
  employee: { id: string; name?: string | null };
  date: Date;
  timeZone?: string;
  tenantId: string | null;
  details?: Record<string, unknown>;
}): void {
  const employeeLabel = input.employee.name || input.employee.id;
  recordAttendanceActivity({
    action: input.action,
    subject: ATTENDANCE_ACTIVITY_SUBJECTS.ATTENDANCE,
    reference: `${employeeLabel} ${formatAttendanceDate(input.date, input.timeZone)}`,
    actor: { systemId: input.systemId },
    tenantId: input.tenantId,
    details: {
      employeeId: input.employee.id,
      employeeName: input.employee.name ?? null,
      ...input.details,
    },
  });
}
