import type { UserDetailDTO } from "@/modules/users";
import { normalizeSelectedSites } from "@/app/admin/hr/lib/siteHelpers";

export interface SelectedSite {
  siteId: string;
  isPrimary: boolean;
}

export interface HrFormData {
  departmentId: string;
  workingHourMode: string;
  attendanceGeofencePolicy: string;
  isAttendanceRequired: boolean;
  startWorkTime: string;
  endWorkTime: string;
  workDays: string;
  flexibleTargetHour: number | string;
  shiftId: string;
}

export const DEFAULT_HR_FORM: HrFormData = {
  departmentId: "",
  workingHourMode: "FIXED",
  attendanceGeofencePolicy: "WARN",
  isAttendanceRequired: true,
  startWorkTime: "",
  endWorkTime: "",
  workDays: "",
  flexibleTargetHour: 8,
  shiftId: "",
};

/** Map UserDetailDTO → field form kepegawaian saja. */
export function toHrForm(usr: UserDetailDTO): HrFormData {
  return {
    departmentId: usr.departmentId ?? usr.department?.id ?? "",
    workingHourMode: usr.workingHourMode ?? "FIXED",
    attendanceGeofencePolicy: usr.attendanceGeofencePolicy ?? "WARN",
    isAttendanceRequired: usr.isAttendanceRequired ?? true,
    startWorkTime: usr.startWorkTime ?? "",
    endWorkTime: usr.endWorkTime ?? "",
    workDays: usr.workDays ?? "",
    flexibleTargetHour: usr.flexibleTargetHour ?? 8,
    shiftId: usr.shiftId ?? "",
  };
}

/** Body PATCH HR-only (tanpa password/role/name/email). */
export function buildHrUpdateBody(
  formData: HrFormData,
  selectedSites: SelectedSite[],
) {
  return {
    departmentId: formData.departmentId || null,
    userSites: normalizeSelectedSites(selectedSites),
    workingHourMode: formData.workingHourMode,
    attendanceGeofencePolicy: formData.attendanceGeofencePolicy,
    isAttendanceRequired: formData.isAttendanceRequired,
    startWorkTime: formData.startWorkTime || null,
    endWorkTime: formData.endWorkTime || null,
    workDays: formData.workDays || null,
    flexibleTargetHour:
      formData.flexibleTargetHour === "" || formData.flexibleTargetHour == null
        ? null
        : Number(formData.flexibleTargetHour),
    shiftId: formData.shiftId || null,
  };
}

export function flexibleTargetAsNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value) || 8;
}
