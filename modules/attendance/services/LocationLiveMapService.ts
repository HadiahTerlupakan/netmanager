import { getTenantIdFromContext } from "@/lib/tenant-context";
import type { EmployeeLocationEntity } from "../domain/entities/LocationTrackingEntity";
import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";
import type { ActiveAttendanceSessionService } from "./ActiveAttendanceSessionService";
import {
  LOCATION_CLOCK_SKEW_MS,
  isRecordedInSession,
} from "./location-session-window";

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

  /** Ambil lokasi terakhir sesi berjalan untuk karyawan yang sedang aktif. */
  async getLiveLocations(filters?: { siteId?: string; departmentId?: string }) {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (!isSuperAdmin && !tenantId) return [];
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

    return sessions
      .map((session) => mapLiveLocation(session, locationMap, now))
      .filter(
        (location): location is NonNullable<typeof location> =>
          location !== null,
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
 * Posisi live satu karyawan, atau null bila sesi ini belum mengirim titik:
 * titik dari sesi sebelumnya bukan posisinya sekarang.
 */
function mapLiveLocation(
  session: ActiveSession,
  locationMap: Map<string, EmployeeLocationEntity>,
  now: number,
) {
  const location = locationMap.get(session.userId);
  if (!location || !isRecordedInSession(location.recordedAt, session.checkIn)) {
    return null;
  }
  const isFresh = now - location.recordedAt.getTime() <= MOVING_FRESHNESS_MS;
  return {
    userId: session.userId,
    userName: session.user.name || "Unknown",
    userImage: session.user.image,
    siteName: session.user.sites?.name || null,
    departmentName: session.user.departments?.name || null,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    speed: location.speed,
    heading: location.heading,
    isMoving: location.isMoving && isFresh,
    batteryLevel: location.batteryLevel,
    recordedAt: location.recordedAt,
    checkInTime: session.checkIn,
  };
}
