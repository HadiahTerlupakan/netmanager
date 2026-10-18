import { calculateHaversineDistance } from "@/lib/geo-utils";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";
import {
  LocationTrackingRepository,
  type LocationData,
} from "../repositories/LocationTrackingRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { UserLookupService } from "@/modules/users";
import { ActiveAttendanceSessionService } from "./ActiveAttendanceSessionService";
import { LocationLiveMapService } from "./LocationLiveMapService";
import { LocationRealtimePublisher } from "./LocationRealtimePublisher";
import { isWithinSessionWindows } from "./location-session-window";

const LOCATION_RETENTION_DAYS = 30;

export class LocationTrackingService {
  private readonly liveMapService: LocationLiveMapService;
  private readonly sessionService: ActiveAttendanceSessionService;
  private readonly realtimePublisher = new LocationRealtimePublisher();

  constructor(
    private readonly locationRepo: ILocationTrackingRepository = new LocationTrackingRepository(),
    attendanceRepo: AttendanceRepository = new AttendanceRepository(),
    private readonly userRepo: UserLookupService = new UserLookupService(),
  ) {
    this.sessionService = new ActiveAttendanceSessionService(attendanceRepo);
    this.liveMapService = new LocationLiveMapService(
      this.sessionService,
      locationRepo,
    );
  }

  /** Simpan lokasi baru untuk user. */
  async saveLocation(
    userId: string,
    data: LocationData,
    tenantId?: string | null,
  ): Promise<void> {
    const effectiveTenantId =
      tenantId ?? (await this.userRepo.findById(userId))?.tenantId;
    const location = await this.locationRepo.createLocation(
      userId,
      effectiveTenantId,
      data,
    );
    if (!location) return;
    await this.realtimePublisher.publishLocationUpdate(
      userId,
      effectiveTenantId,
      location.recordedAt,
    );
  }

  /**
   * Simpan antrean lokasi offline. Hanya titik yang terekam di dalam salah
   * satu sesi kerja user yang disimpan: antrean biasanya baru terkirim sesudah
   * check-out, jadi syarat "sedang check-in" akan membuang semuanya.
   */
  async saveLocations(
    userId: string,
    locations: LocationData[],
    tenantId?: string | null,
  ): Promise<number> {
    const effectiveTenantId =
      tenantId ?? (await this.userRepo.findById(userId))?.tenantId;
    const withinSessions = await this.filterWithinSessions(
      userId,
      locations,
      effectiveTenantId,
    );
    if (withinSessions.length === 0) return 0;

    const result = await this.locationRepo.createLocationsBatch(
      userId,
      effectiveTenantId,
      withinSessions,
    );
    const latest = this.findLatestLocation(withinSessions);
    if (result.count > 0 && latest?.recordedAt) {
      await this.realtimePublisher.publishLocationUpdate(
        userId,
        effectiveTenantId,
        latest.recordedAt,
      );
    }
    return result.count;
  }

  /** Cek apakah user sedang dalam sesi kerja yang masih berjalan. */
  async isUserCurrentlyCheckedIn(userId: string): Promise<boolean> {
    const user = await this.userRepo.findById(userId);
    return this.sessionService.isUserInActiveSession(
      userId,
      user?.tenantId || undefined,
    );
  }

  /** Ambil lokasi terakhir untuk semua karyawan yang sedang aktif. */
  async getLiveLocations(filters?: { siteId?: string; departmentId?: string }) {
    return this.liveMapService.getLiveLocations(filters);
  }

  /** Ambil history lokasi untuk user tertentu dalam rentang waktu. */
  async getLocationHistory(userId: string, startDate: Date, endDate: Date) {
    return this.locationRepo.findLocationsByUserIdAndDateRange(
      userId,
      startDate,
      endDate,
    );
  }

  /** Hapus data lokasi yang lebih tua dari retention period. */
  async cleanupOldLocations(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - LOCATION_RETENTION_DAYS);
    const result = await this.locationRepo.deleteLocationsBefore(cutoffDate);
    return result.count;
  }

  /** Hitung statistik lokasi untuk user. */
  async getLocationStats(userId: string, startDate: Date, endDate?: Date) {
    const startOfDay = new Date(startDate);
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());
    const endOfDay = new Date(endDate ?? startDate);
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());
    const locations = await this.locationRepo.findLocationsByUserIdAndDateRange(
      userId,
      startOfDay,
      endOfDay,
    );

    if (locations.length === 0) return this.emptyLocationStats();
    return {
      totalPoints: locations.length,
      firstLocation: locations[0]?.recordedAt ?? null,
      lastLocation: locations[locations.length - 1]?.recordedAt ?? null,
      totalDistance: Math.round(this.calculateTotalDistance(locations)),
    };
  }

  private async filterWithinSessions(
    userId: string,
    locations: LocationData[],
    tenantId: string | null | undefined,
  ): Promise<LocationData[]> {
    const timed = locations.filter(
      (location): location is LocationData & { recordedAt: Date } =>
        location.recordedAt instanceof Date,
    );
    if (timed.length === 0) return [];
    const times = timed.map((location) => location.recordedAt.getTime());
    const windows = await this.sessionService.findSessionWindows({
      userId,
      from: new Date(Math.min(...times)),
      to: new Date(Math.max(...times)),
      tenantId: tenantId || undefined,
    });
    return timed.filter((location) =>
      isWithinSessionWindows(location.recordedAt, windows),
    );
  }

  private findLatestLocation(locations: LocationData[]) {
    if (locations.length === 0) return null;
    return locations.reduce((previous, current) => {
      const previousDate = previous.recordedAt
        ? new Date(previous.recordedAt)
        : new Date(0);
      const currentDate = current.recordedAt
        ? new Date(current.recordedAt)
        : new Date(0);
      return previousDate > currentDate ? previous : current;
    });
  }

  private emptyLocationStats(): {
    totalPoints: number;
    firstLocation: Date | null;
    lastLocation: Date | null;
    totalDistance: number;
  } {
    return {
      totalPoints: 0,
      firstLocation: null,
      lastLocation: null,
      totalDistance: 0,
    };
  }

  private calculateTotalDistance(
    locations: Array<{ latitude: number; longitude: number }>,
  ) {
    let totalDistance = 0;
    for (let index = 1; index < locations.length; index++) {
      const previous = locations[index - 1];
      const current = locations[index];
      if (!previous || !current) continue;
      totalDistance += calculateHaversineDistance(
        previous.latitude,
        previous.longitude,
        current.latitude,
        current.longitude,
      );
    }
    return totalDistance;
  }
}
