import { GeofenceService } from "./GeofenceService";
import type { CachedUserAttendanceSettings } from "./attendance-service-helpers";
import type { CheckInParams } from "./attendance-service.contracts";

export class AttendanceMutationGeofenceService {
  constructor(private readonly geofenceService: GeofenceService) {}

  /** Validasi geofence check-in dan kembalikan metadata lokasi. */
  async resolveCheckInGeofence(
    params: CheckInParams,
    userDetails: CachedUserAttendanceSettings | null,
  ) {
    if (!this.hasCoordinates(params)) {
      this.assertCoordinatesProvidedForStrict(
        userDetails?.attendanceGeofencePolicy,
      );
      return {
        status: "UNKNOWN",
        distance: null as number | null,
        siteName: null as string | null,
      };
    }
    const geoCheck = await this.geofenceService.validateGeofence(
      params.userId,
      params.latitude,
      params.longitude,
    );
    this.assertAllowedGeofence(
      geoCheck.isInside,
      userDetails?.attendanceGeofencePolicy,
    );
    return {
      status: geoCheck.isInside ? "INSIDE" : "OUTSIDE",
      distance: geoCheck.nearestDistance,
      siteName: geoCheck.nearestSiteName,
    };
  }

  /** Validasi geofence check-out dan kembalikan status lokasi. */
  async resolveCheckOutGeofence(
    params: { userId: string; latitude?: number; longitude?: number },
    attendance: { user: { attendanceGeofencePolicy?: string | null } },
  ) {
    if (!this.hasCoordinates(params)) {
      this.assertCoordinatesProvidedForStrict(
        attendance.user.attendanceGeofencePolicy,
      );
      return { status: "UNKNOWN", distance: null as number | null };
    }
    const geoCheck = await this.geofenceService.validateGeofence(
      params.userId,
      params.latitude,
      params.longitude,
    );
    this.assertAllowedGeofence(
      geoCheck.isInside,
      attendance.user.attendanceGeofencePolicy,
    );
    return {
      status: geoCheck.isInside ? "INSIDE" : "OUTSIDE",
      distance: geoCheck.nearestDistance,
    };
  }

  private hasCoordinates(params: {
    latitude?: number;
    longitude?: number;
  }): params is { latitude: number; longitude: number } {
    return params.latitude !== undefined && params.longitude !== undefined;
  }

  private assertAllowedGeofence(isInside: boolean, policy?: string | null) {
    if (!isInside && (policy ?? "WARN") === "STRICT") {
      throw new Error("OUTSIDE_GEOFENCE");
    }
  }

  /**
   * Tutup bypass: kalau policy STRICT, koordinat null/undefined tidak boleh
   * lolos sebagai status "UNKNOWN". Tanpa guard ini, karyawan bisa matikan
   * GPS untuk check-in dari mana saja (compliance & abuse vector).
   */
  private assertCoordinatesProvidedForStrict(policy?: string | null) {
    if ((policy ?? "WARN") === "STRICT") {
      throw new Error("COORDINATES_REQUIRED");
    }
  }
}
