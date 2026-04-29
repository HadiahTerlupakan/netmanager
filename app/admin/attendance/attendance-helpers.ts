import type { Attendance } from "./attendance-types";

/** Cek apakah absensi dapat dikoreksi sebagai missed check-in. */
export function canCorrectMissedCheckInAttendance(item: Attendance) {
  const normalizedDisplayStatus = item.displayStatus?.trim().toUpperCase();

  return (
    ["ABSENT", "ALPHA"].includes(item.status) ||
    normalizedDisplayStatus === "TIDAK HADIR"
  );
}
