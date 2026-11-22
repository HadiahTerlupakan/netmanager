/**
 * Status absen yang dihitung "hadir" di laporan. NO_CHECKOUT (lupa absen
 * pulang) tetap hadir, sama dengan penggajian (`AttendancePayrollBridge`).
 */
export const PRESENT_ATTENDANCE_STATUSES = [
  "ON_TIME",
  "LATE",
  "NO_CHECKOUT",
] as const;

/** Status absen yang dihitung alpha (tidak masuk tanpa izin). */
export const ABSENT_ATTENDANCE_STATUSES = ["ALPHA", "ABSENT"] as const;
