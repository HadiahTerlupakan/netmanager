import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { EmployeeLocationEntity } from "../domain/entities/LocationTrackingEntity";
import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";
import type { ActiveAttendanceSessionService } from "./ActiveAttendanceSessionService";
import {
  LOCATION_CLOCK_SKEW_MS,
  isRecordedInSession,
} from "./location-session-window";
import { evaluateTracking } from "./tracking-gap";

/**
 * Batas umur titik "bergerak". HP yang berhenti tidak mengirim titik "diam"
 * sampai heartbeat berikutnya, jadi tanpa batas ini marker tetap hijau
 * berjam-jam sesudah karyawannya berhenti.
 */
const MOVING_FRESHNESS_MS = 15 * 60 * 1000;

type ActiveSession = Awaited<
  ReturnType<ActiveAttendanceSessionService["findActiveSessions"]>
>[number];

export class LocationLiveMapService {
  constructor(
    private readonly sessionService: ActiveAttendanceSessionService,
    private readonly locationRepo: ILocationTrackingRepository,
  ) {}

  /** Karyawan yang sedang bekerja, dengan lokasi terakhir sesi berjalannya. */
  async getLiveLocations(filters?: { siteId?: string; departmentId?: string }) {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (!isSuperAdmin && !tenantId) return [];
    return this.getLiveLocationsForTenant({ tenantId, isSuperAdmin, filters });
  }

  /** Sama dengan `getLiveLocations`, untuk pemanggil tanpa konteks request. */
  async getLiveLocationsForTenant({
    tenantId,
    isSuperAdmin,
    filters,
  }: {
    tenantId: string | null;
    isSuperAdmin: boolean;
    filters?: { siteId?: string; departmentId?: string };
  }) {
    const sessions = await this.sessionService.findActiveSessions({
      timezoneTenantId: tenantId || undefined,
      tenantId: isSuperAdmin ? undefined : tenantId || undefined,
      userFilter: filters,
    });
    if (sessions.length === 0) return [];

    const latestLocations = await this.locationRepo.getLatestLocationsForUsers(
      sessions.map((session) => session.userId),
      tenantId,
      isSuperAdmin,
      earliestSessionStart(sessions),
    );
    const locationMap = new Map(
      latestLocations.map((location) => [location.userId, location]),
    );
    const now = Date.now();

    return sessions.map((session) =>
      mapLiveLocation(session, locationMap, now),
    );
  }
}

function earliestSessionStart(sessions: ActiveSession[]): Date {
  const earliest = Math.min(
    ...sessions.map((session) => session.checkIn.getTime()),
  );
  return new Date(earliest - LOCATION_CLOCK_SKEW_MS);
}

/**
 * Posisi live satu karyawan. Titik dari sesi sebelumnya bukan posisinya
 * sekarang, jadi sesi yang belum mengirim titik tampil tanpa koordinat dan
 * ditandai tracking mati begitu jedanya melewati batas.
 */
function mapLiveLocation(
  session: ActiveSession,
  locationMap: Map<string, EmployeeLocationEntity>,
  now: number,
) {
  const stored = locationMap.get(session.userId);
  const location =
    stored && isRecordedInSession(stored.recordedAt, session.checkIn)
      ? stored
      : null;
  const tracking = evaluateTracking({
    checkIn: session.checkIn,
    lastPointAt: location?.recordedAt ?? null,
    reportedStatus: session.trackingStatus,
    reportedAt: session.trackingStatusAt,
    now: new Date(now),
  });
  const isFresh =
    location !== null &&
    now - location.recordedAt.getTime() <= MOVING_FRESHNESS_MS;
  return {
    userId: session.userId,
    userName: session.user.name || "Unknown",
    userImage: session.user.image,
    siteName: session.user.sites?.name || null,
    departmentName: session.user.departments?.name || null,
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    accuracy: location?.accuracy ?? null,
    speed: location?.speed ?? null,
    heading: location?.heading ?? null,
    isMoving: Boolean(location?.isMoving) && isFresh && !tracking.isOff,
    batteryLevel: location?.batteryLevel ?? null,
    recordedAt: location?.recordedAt ?? null,
    checkInTime: session.checkIn,
    trackingOff: tracking.isOff,
    trackingOffSince: tracking.offSince,
    trackingOffReason: tracking.reason,
  };
}
