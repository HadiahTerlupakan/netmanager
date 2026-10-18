import { format } from "date-fns";

import type { EmployeeLocation } from "./live-location.types";

const REASON_LABELS: Record<string, string> = {
  NO_POINT: "Belum mengirim lokasi sejak check-in",
  STALE: "Lokasi tidak terkirim",
  BACKGROUND_DENIED: "Izin lokasi latar belakang dimatikan",
  PERMISSION_DENIED: "Izin lokasi ditolak",
  GPS_OFF: "GPS dimatikan",
  START_FAILED: "Tracking gagal dimulai",
};

/** Keterangan tracking mati untuk kartu dan popup, atau null bila hidup. */
export function trackingOffLabel(location: EmployeeLocation): string | null {
  if (!location.trackingOff) return null;
  const reason =
    REASON_LABELS[location.trackingOffReason ?? ""] ?? "Tracking mati";
  // Tanpa titik, "sejak" sama dengan jam check-in yang sudah tampil di kartu.
  if (location.trackingOffReason === "NO_POINT" || !location.trackingOffSince) {
    return reason;
  }
  return `${reason} (sejak ${format(new Date(location.trackingOffSince), "HH:mm")})`;
}
