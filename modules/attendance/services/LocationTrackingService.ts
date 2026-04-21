import { getTenantIdFromContext } from "@/lib/tenant-context";
import { calculateHaversineDistance } from "@/lib/geo-utils";
import { firebaseRealtimeService } from "@/lib/realtime";
import { toStartOfDay, toEndOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import {
  LocationTrackingRepository,
  type LocationData,
} from "../repositories/LocationTrackingRepository";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import { UserRepository } from "@/modules/users";

/**
 * LocationTrackingService - Mengelola data lokasi karyawan selama jam kerja
 * Tracking aktif setelah check-in dan berhenti setelah check-out
 */
export class LocationTrackingService {
  private readonly LOCATION_RETENTION_DAYS = 30; // Simpan data 30 hari
  private locationRepo = new LocationTrackingRepository();
  private attendanceRepo = new AttendanceRepository();
  private userRepo = new UserRepository();

  private async publishLocationUpdate(
    userId: string,
    tenantId: string | null | undefined,
    payload: {
      latitude: number;
      longitude: number;
      heading?: number | null;
      isMoving?: boolean;
      batteryLevel?: number | null;
      recordedAt?: Date;
      accuracy?: number | null;
      speed?: number | null;
    },
  ): Promise<void> {
    if (!tenantId) {
      return;
    }

    await firebaseRealtimeService.publish({
      type: "admin.location.update",
      scope: { kind: "admin", id: `location:${tenantId}` },
      payload: {
        userId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        heading: payload.heading,
        isMoving: payload.isMoving ?? false,
        batteryLevel: payload.batteryLevel,
        recordedAt: payload.recordedAt ?? new Date(),
        accuracy: payload.accuracy,
        speed: payload.speed,
      },
    });
  }

  constructor() {}

  /**
   * Simpan lokasi baru untuk user
   */
  async saveLocation(userId: string, data: LocationData): Promise<void> {
    // Fetch user's tenantId for socket room isolation
    const user = await this.userRepo.findById(userId);

    const location = await this.locationRepo.createLocation(
      userId,
      user?.tenantId,
      data,
    );

    await this.publishLocationUpdate(userId, user?.tenantId, {
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      isMoving: location.isMoving,
      batteryLevel: location.batteryLevel,
      recordedAt: location.recordedAt,
      accuracy: location.accuracy,
      speed: location.speed,
    });
  }

  /**
   * Batch save multiple locations (untuk sync offline)
   */
  async saveLocations(
    userId: string,
    locations: LocationData[],
  ): Promise<number> {
    // Fetch user's tenantId for socket room isolation
    const user = await this.userRepo.findById(userId);

    const result = await this.locationRepo.createLocationsBatch(
      userId,
      user?.tenantId,
      locations,
    );

    if (user?.tenantId && locations.length > 0) {
      const latest = locations.reduce((prev, current) => {
        const prevDate = prev.recordedAt
          ? new Date(prev.recordedAt)
          : new Date(0);
        const currDate = current.recordedAt
          ? new Date(current.recordedAt)
          : new Date(0);
        return prevDate > currDate ? prev : current;
      });

      await this.publishLocationUpdate(userId, user.tenantId, {
        latitude: latest.latitude,
        longitude: latest.longitude,
        heading: latest.heading,
        isMoving: latest.isMoving,
        batteryLevel: latest.batteryLevel,
        recordedAt: latest.recordedAt,
        accuracy: latest.accuracy,
        speed: latest.speed,
      });
    }

    return result.count;
  }

  /**
   * Helper to get today's start (00:00) in tenant's timezone converted back to UTC
   */
  private async getTodayTenantStartUTC(tenantId?: string): Promise<Date> {
    const timezone = await getTimezone(tenantId);
    return toStartOfDay(new Date(), timezone);
  }

  /**
   * Cek apakah user sedang dalam status aktif (sudah check-in, belum check-out)
   */
  async isUserCurrentlyCheckedIn(userId: string): Promise<boolean> {
    // Get user's tenantId first
    const user = await this.userRepo.findById(userId);

    const todayUTC = await this.getTodayTenantStartUTC(
      user?.tenantId || undefined,
    );

    const activeAttendance = await this.attendanceRepo.findFirst({
      where: {
        userId,
        checkIn: { gte: todayUTC },
        checkOut: null,
      },
    });

    return !!activeAttendance;
  }

  /**
   * Ambil lokasi terakhir untuk semua karyawan yang sedang aktif (untuk Live Map)
   * @param filters Optional filters for RBAC (siteId, departmentId)
   */
  async getLiveLocations(filters?: {
    siteId?: string;
    departmentId?: string;
  }): Promise<
    Array<{
      userId: string;
      userName: string;
      userImage: string | null;
      siteName: string | null;
      departmentName: string | null;
      latitude: number;
      longitude: number;
      accuracy: number | null;
      speed: number | null;
      heading: number | null;
      isMoving: boolean;
      batteryLevel: number | null;
      recordedAt: Date;
      checkInTime: Date;
    }>
  > {
    type ActiveAttendanceWithUser = {
      userId: string;
      checkIn: Date;
      user: {
        id: string;
        name: string | null;
        image: string | null;
        sites: { name: string } | null;
        departments: { name: string } | null;
      };
    };

    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    const effectiveTenantId =
      !isSuperAdmin && !tenantId ? "___MISSING_TENANT_ID___" : tenantId;
    const todayUTC = await this.getTodayTenantStartUTC(
      effectiveTenantId || undefined,
    );

    // Build user filter for RBAC restrictions
    const userFilter: { siteId?: string; departmentId?: string } = {};
    if (filters?.siteId) {
      userFilter.siteId = filters.siteId;
    }
    if (filters?.departmentId) {
      userFilter.departmentId = filters.departmentId;
    }

    // Cari semua user yang sedang check-in (belum check-out)
    const activeAttendances = (await this.attendanceRepo.findMany({
      where: {
        checkIn: { gte: todayUTC },
        checkOut: null,
        user: Object.keys(userFilter).length > 0 ? userFilter : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            sites: { select: { name: true } },
            departments: { select: { name: true } },
          },
        },
      },
    })) as ActiveAttendanceWithUser[];

    // Early return if no active attendances
    if (activeAttendances.length === 0) {
      return [];
    }

    // OPTIMIZED: Batch fetch latest locations in SINGLE query
    // This eliminates N+1 query problem (was: 1 query per user)
    const userIds = activeAttendances.map((a) => a.userId);

    const latestLocations = await this.locationRepo.getLatestLocationsForUsers(
      userIds,
      effectiveTenantId,
      isSuperAdmin,
    );

    // Create lookup map for O(1) access
    const locationMap = new Map(
      latestLocations.map((loc) => [loc.userId, loc]),
    );

    // Map results with location data
    const results = activeAttendances
      .map((attendance) => {
        const location = locationMap.get(attendance.userId);
        if (!location) return null;

        const userData = attendance.user;

        return {
          userId: attendance.userId,
          userName: userData.name || "Unknown",
          userImage: userData.image,
          siteName: userData.sites?.name || null,
          departmentName: userData.departments?.name || null,
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          speed: location.speed,
          heading: location.heading,
          isMoving: location.isMoving,
          batteryLevel: location.batteryLevel,
          recordedAt: location.recordedAt,
          checkInTime: attendance.checkIn,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return results;
  }

  /**
   * Ambil history lokasi untuk user tertentu dalam rentang waktu
   */
  async getLocationHistory(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<
    Array<{
      latitude: number;
      longitude: number;
      accuracy: number | null;
      speed: number | null;
      isMoving: boolean;
      recordedAt: Date;
    }>
  > {
    const locations = await this.locationRepo.findLocationsByUserIdAndDateRange(
      userId,
      startDate,
      endDate,
    );
    return locations;
  }

  /**
   * Hapus data lokasi yang lebih tua dari retention period
   */
  async cleanupOldLocations(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.LOCATION_RETENTION_DAYS);

    const result = await this.locationRepo.deleteLocationsBefore(cutoffDate);
    return result.count;
  }

  /**
   * Hitung statistik lokasi untuk user
   */
  async getLocationStats(
    userId: string,
    startDate: Date,
    endDate?: Date,
  ): Promise<{
    totalPoints: number;
    firstLocation: Date | null;
    lastLocation: Date | null;
    totalDistance: number;
  }> {
    const startOfDay = new Date(startDate);
    startOfDay.setTime(toStartOfDay(startOfDay).getTime());

    const endOfDay = new Date(endDate ?? startDate);
    endOfDay.setTime(toEndOfDay(endOfDay).getTime());

    const locations = await this.locationRepo.findLocationsByUserIdAndDateRange(
      userId,
      startOfDay,
      endOfDay,
    );

    if (locations.length === 0) {
      return {
        totalPoints: 0,
        firstLocation: null,
        lastLocation: null,
        totalDistance: 0,
      };
    }

    // Calculate total distance traveled
    let totalDistance = 0;
    for (let i = 1; i < locations.length; i++) {
      const prev = locations[i - 1];
      const curr = locations[i];

      if (prev && curr) {
        totalDistance += this.calculateDistance(
          prev.latitude,
          prev.longitude,
          curr.latitude,
          curr.longitude,
        );
      }
    }

    const first = locations[0];
    const last = locations[locations.length - 1];

    return {
      totalPoints: locations.length,
      firstLocation: first?.recordedAt ?? null,
      lastLocation: last?.recordedAt ?? null,
      totalDistance: Math.round(totalDistance),
    };
  }

  /**
   * Haversine formula untuk menghitung jarak
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    return calculateHaversineDistance(lat1, lng1, lat2, lng2);
  }
}
