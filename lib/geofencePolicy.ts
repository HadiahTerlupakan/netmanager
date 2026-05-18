/**
 * Single source of truth untuk attendance geofence policy.
 * Sebelumnya tipe ini didefinisikan ulang di 3+ file backend (`attendance-service-helpers`,
 * `GeofenceService`, `UserService.helpers`), dan separately di mobile
 * (`mobile-netmanager/src/utils/attendanceGeofencePolicy.ts`).
 *
 * Konsolidasi ke sini agar deviasi (mis. tambah `OFFLINE` di salah satu)
 * langsung ketahuan di compile time.
 */

export type AttendanceGeofencePolicy = "STRICT" | "WARN" | "DISABLED";

export const ATTENDANCE_GEOFENCE_POLICIES: readonly AttendanceGeofencePolicy[] =
  ["STRICT", "WARN", "DISABLED"];

export const DEFAULT_ATTENDANCE_GEOFENCE_POLICY: AttendanceGeofencePolicy =
  "WARN";

export function isAttendanceGeofencePolicy(
  value: unknown,
): value is AttendanceGeofencePolicy {
  return value === "STRICT" || value === "WARN" || value === "DISABLED";
}
