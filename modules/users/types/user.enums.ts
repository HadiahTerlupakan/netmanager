export const WorkingHourMode = {
  FIXED: "FIXED",
  SHIFT: "SHIFT",
  FLEXIBLE: "FLEXIBLE",
} as const;

export type WorkingHourMode =
  (typeof WorkingHourMode)[keyof typeof WorkingHourMode];

export type LeaveType = "SAKIT" | "CUTI" | "IZIN" | "LAINNYA" | "TUKAR_LIBUR";
