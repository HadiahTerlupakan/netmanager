import { ATTENDANCE_CONSTANTS } from "@/modules/attendance/utils/constants";

export function hasAutoCheckoutNote(notes?: string | null): boolean {
  if (!notes) {
    return false;
  }

  return (
    notes.includes(ATTENDANCE_CONSTANTS.AUTO_CHECKOUT_NOTE) ||
    notes.includes("Auto checkout by system (Mangkir)") ||
    notes.includes("Lupa Absen Pulang")
  );
}

export function isHistoricalAutoCheckoutAbsence(input: {
  status?: string | null;
  notes?: string | null;
  checkOut?: string | Date | null;
}): boolean {
  return Boolean(input.status === "NO_CHECKOUT" && input.checkOut);
}

export function getCanonicalAttendanceLabel(input: {
  status?: string | null;
  notes?: string | null;
  checkOut?: string | Date | null;
  displayStatus?: string | null;
}): string {
  if (isHistoricalAutoCheckoutAbsence(input)) {
    return input.displayStatus?.trim() || "Lupa Absen Pulang";
  }

  if (input.status === "NO_CHECKOUT") {
    return input.displayStatus?.trim() || "Lupa Absen Pulang";
  }

  if (input.status === "ABSENT" || input.status === "ALPHA") {
    return "Tidak Hadir";
  }

  return "";
}

export function getDayOffDisplayLabel(input: {
  status?: string | null;
  notes?: string | null;
}): string {
  if (input.status !== "DAY_OFF") {
    return "";
  }

  const notes = input.notes ?? "";

  if (
    notes.includes("Auto-generated from Leave Request") ||
    notes.includes("Updated by Leave Approval")
  ) {
    return "Tukar Libur";
  }

  if (notes.includes("Hari Libur (Day Off)")) {
    return "Libur Nasional";
  }

  if (notes.includes("Hari Off (Day Off)")) {
    return "Hari Libur";
  }

  return "Libur";
}

export function getPermitDisplayLabel(input: {
  status?: string | null;
  notes?: string | null;
}): string {
  if (input.status !== "PERMIT") {
    return "";
  }

  const notes = input.notes ?? "";

  if (notes.includes("(CUTI)")) {
    return "Cuti";
  }

  if (notes.includes("(IZIN)")) {
    return "Izin";
  }

  return "Izin";
}
