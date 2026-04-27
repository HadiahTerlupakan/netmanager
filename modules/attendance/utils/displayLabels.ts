import { ATTENDANCE_CONSTANTS } from "@/modules/attendance/utils/constants";

const LEGACY_AUTO_CHECKOUT_NOTES = [
  "Auto checkout by system (Mangkir)",
  "Lupa Absen Pulang",
] as const;

const DAY_OFF_EXCHANGE_NOTES = [
  "Auto-generated from Leave Request",
  "Updated by Leave Approval",
] as const;

const NATIONAL_HOLIDAY_NOTE = "Hari Libur (Day Off)";
const REGULAR_DAY_OFF_NOTE = "Hari Off (Day Off)";
const LEAVE_PERMIT_NOTE = "(CUTI)";
const GENERAL_PERMIT_NOTE = "(IZIN)";
const NO_CHECKOUT_LABEL = "Lupa Absen Pulang";
const ABSENT_LABEL = "Tidak Hadir";
const DEFAULT_DAY_OFF_LABEL = "Libur";
const EXCHANGE_DAY_OFF_LABEL = "Tukar Libur";
const NATIONAL_DAY_OFF_LABEL = "Libur Nasional";
const REGULAR_DAY_OFF_LABEL = "Hari Libur";
const LEAVE_LABEL = "Cuti";
const PERMIT_LABEL = "Izin";
const NO_CHECKOUT_STATUS = "NO_CHECKOUT";
const ABSENT_STATUSES = new Set(["ABSENT", "ALPHA"]);

interface AttendanceLabelInput {
  status?: string | null;
  notes?: string | null;
  checkOut?: string | Date | null;
  displayStatus?: string | null;
}

/** Memeriksa apakah catatan absensi menandakan auto checkout. */
export function hasAutoCheckoutNote(notes?: string | null): boolean {
  if (!notes) {
    return false;
  }

  return [
    ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE,
    ...LEGACY_AUTO_CHECKOUT_NOTES,
  ].some((note) => notes.includes(note));
}

/** Mendeteksi data historis no-checkout yang sudah memiliki checkout otomatis. */
export function isHistoricalAutoCheckoutAbsence(
  input: AttendanceLabelInput,
): boolean {
  return Boolean(input.status === NO_CHECKOUT_STATUS && input.checkOut);
}

/** Menghasilkan label status absensi canonical untuk UI. */
export function getCanonicalAttendanceLabel(
  input: AttendanceLabelInput,
): string {
  if (input.status === NO_CHECKOUT_STATUS) {
    return input.displayStatus?.trim() || NO_CHECKOUT_LABEL;
  }

  if (ABSENT_STATUSES.has(input.status ?? "")) {
    return ABSENT_LABEL;
  }

  return "";
}

/** Menghasilkan label tampilan untuk status day off. */
export function getDayOffDisplayLabel(input: AttendanceLabelInput): string {
  if (input.status !== "DAY_OFF") {
    return "";
  }

  if (includesAnyNote(input.notes, DAY_OFF_EXCHANGE_NOTES)) {
    return EXCHANGE_DAY_OFF_LABEL;
  }

  return getDayOffLabelFromNotes(input.notes);
}

/** Menghasilkan label tampilan untuk status permit. */
export function getPermitDisplayLabel(input: AttendanceLabelInput): string {
  if (input.status !== "PERMIT") {
    return "";
  }

  if (input.notes?.includes(LEAVE_PERMIT_NOTE)) {
    return LEAVE_LABEL;
  }

  if (input.notes?.includes(GENERAL_PERMIT_NOTE)) {
    return PERMIT_LABEL;
  }

  return PERMIT_LABEL;
}

function includesAnyNote(
  notes: string | null | undefined,
  noteCandidates: readonly string[],
): boolean {
  if (!notes) {
    return false;
  }

  return noteCandidates.some((noteCandidate) => notes.includes(noteCandidate));
}

function getDayOffLabelFromNotes(notes?: string | null): string {
  if (notes?.includes(NATIONAL_HOLIDAY_NOTE)) {
    return NATIONAL_DAY_OFF_LABEL;
  }

  if (notes?.includes(REGULAR_DAY_OFF_NOTE)) {
    return REGULAR_DAY_OFF_LABEL;
  }

  return DEFAULT_DAY_OFF_LABEL;
}
