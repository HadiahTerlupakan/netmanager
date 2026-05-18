import { calculateHaversineDistance } from "@/lib/geo-utils";
import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis";
import { UserLookupService } from "@/modules/users";
import type { AttendanceGeofencePolicy } from "@/lib/geofencePolicy";

interface GeofenceZone {
  siteId: string;
  siteName: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface GeofenceData {
  zones: GeofenceZone[];
  policy: AttendanceGeofencePolicy;
}

const GEOFENCE_CACHE_TTL_SECONDS = 900; // 15 minutes
const GEOFENCE_CACHE_PREFIX = "geofence:user:";

/**
 * GeofenceService - Validasi lokasi absensi terhadap zona geofence Sites
 * Menggunakan Formula Haversine untuk menghitung jarak antara 2 koordinat
 *
 * Multi-site Support: User bisa punya banyak sites via userSites relation
 */
export class GeofenceService {
  private userRepo: UserLookupService;

  constructor() {
    this.userRepo = new UserLookupService();
  }

  /**
   * Get combined geofence data (zones + policy) for a user.
   * Uses Redis cache with 15-minute TTL to avoid repeated DB calls.
   */
  async getGeofenceDataForUser(userId: string): Promise<GeofenceData> {
    const cacheKey = `${GEOFENCE_CACHE_PREFIX}${userId}`;

    // Try cache first
    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    // Fetch both in parallel from DB
    const [user, rawPolicy] = await Promise.all([
      this.userRepo.findUserWithSites(userId),
      this.userRepo.getGeofencePolicy(userId),
    ]);

    const policy = this.normalizePolicy(rawPolicy);
    const zones = user ? this.buildZonesFromUser(user) : [];

    const data: GeofenceData = { zones, policy };
    await this.writeCache(cacheKey, data);
    return data;
  }

  async getPolicyForUser(userId: string): Promise<AttendanceGeofencePolicy> {
    const { policy } = await this.getGeofenceDataForUser(userId);
    return policy;
  }

  /**
   * Menghitung jarak antara 2 koordinat menggunakan Formula Haversine
   * @returns Jarak dalam meter
   */
  calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    return calculateHaversineDistance(lat1, lng1, lat2, lng2);
  }

  /**
   * Cek apakah koordinat berada dalam zona geofence
   */
  isInsideZone(
    userLat: number,
    userLng: number,
    zoneLat: number,
    zoneLng: number,
    radiusMeters: number,
  ): boolean {
    const distance = this.calculateDistance(userLat, userLng, zoneLat, zoneLng);
    return distance <= radiusMeters;
  }

  /**
   * Collect valid sites from user data (multi-site + legacy fallback)
   */
  private collectValidSites(
    user: NonNullable<
      Awaited<ReturnType<typeof this.userRepo.findUserWithSites>>
    >,
  ) {
    const validSites: Array<{
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      attendanceRadius: number;
    }> = [];

    // Multi-site: get sites from userSites
    if (user.userSites && user.userSites.length > 0) {
      for (const us of user.userSites) {
        const site = us.site;
        if (
          site.isActive &&
          site.latitude !== null &&
          site.longitude !== null
        ) {
          validSites.push({
            id: site.id,
            name: site.name,
            latitude: site.latitude,
            longitude: site.longitude,
            attendanceRadius: site.attendanceRadius,
          });
        }
      }
    }

    // Legacy fallback: use single site if no userSites
    if (
      validSites.length === 0 &&
      user.sites &&
      user.sites.isActive &&
      user.sites.latitude !== null &&
      user.sites.longitude !== null
    ) {
      validSites.push({
        id: user.sites.id,
        name: user.sites.name,
        latitude: user.sites.latitude,
        longitude: user.sites.longitude,
        attendanceRadius: user.sites.attendanceRadius,
      });
    }

    return validSites;
  }

  /**
   * Validasi koordinat terhadap sites yang dimiliki user
   * Multi-site: Cek semua sites dari userSites, fallback ke legacy sites
   * @returns Object dengan status validasi dan info zona terdekat
   */
  async validateGeofence(
    userId: string,
    latitude: number,
    longitude: number,
  ): Promise<{
    isInside: boolean;
    nearestDistance: number | null;
    nearestSiteName: string | null;
    nearestSiteId: string | null;
  }> {
    // Ambil sites yang dimiliki user (multi-site + legacy fallback) via repository
    const user = await this.userRepo.findUserWithSites(userId);

    if (!user) {
      return {
        isInside: false,
        nearestDistance: null,
        nearestSiteName: null,
        nearestSiteId: null,
      };
    }

    const validSites = this.collectValidSites(user);

    // If no valid sites, allow attendance anywhere
    if (validSites.length === 0) {
      return {
        isInside: true,
        nearestDistance: null,
        nearestSiteName: null,
        nearestSiteId: null,
      };
    }

    // Check against all sites, find nearest
    let nearestDistance = Infinity;
    let nearestSiteName: string | null = null;
    let nearestSiteId: string | null = null;
    let isInside = false;

    for (const site of validSites) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        site.latitude,
        site.longitude,
      );

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSiteName = site.name;
        nearestSiteId = site.id;
      }

      if (distance <= site.attendanceRadius) {
        isInside = true;
      }
    }

    return {
      isInside,
      nearestDistance: Math.round(nearestDistance),
      nearestSiteName,
      nearestSiteId,
    };
  }

  /**
   * Ambil geofence zones untuk user tertentu
   * Multi-site: Return semua sites dari userSites + legacy fallback
   * Uses cached data from getGeofenceDataForUser.
   */
  async getZonesForUser(userId: string): Promise<GeofenceZone[]> {
    const { zones } = await this.getGeofenceDataForUser(userId);
    return zones;
  }

  /** Normalize raw policy string to valid enum value. */
  private normalizePolicy(rawPolicy: string | null): AttendanceGeofencePolicy {
    return rawPolicy === "STRICT" ||
      rawPolicy === "DISABLED" ||
      rawPolicy === "WARN"
      ? rawPolicy
      : "WARN";
  }

  /** Build zone list from user data (multi-site + legacy fallback). */
  private buildZonesFromUser(
    user: NonNullable<
      Awaited<ReturnType<typeof this.userRepo.findUserWithSites>>
    >,
  ): GeofenceZone[] {
    const validSites = this.collectValidSites(user);
    return validSites.map((site) => ({
      siteId: site.id,
      siteName: site.name,
      latitude: site.latitude,
      longitude: site.longitude,
      radius: site.attendanceRadius,
    }));
  }

  /** Read geofence data from Redis cache. */
  private async readCache(cacheKey: string): Promise<GeofenceData | null> {
    try {
      const raw = await redis.get(cacheKey);
      if (!raw) return null;
      return JSON.parse(raw) as GeofenceData;
    } catch (error) {
      logger.error(
        `[GeofenceService] Failed to read cache for ${cacheKey}:`,
        error,
      );
      return null;
    }
  }

  /** Write geofence data to Redis cache with TTL. */
  private async writeCache(
    cacheKey: string,
    data: GeofenceData,
  ): Promise<void> {
    try {
      await redis.setex(
        cacheKey,
        GEOFENCE_CACHE_TTL_SECONDS,
        JSON.stringify(data),
      );
    } catch (error) {
      logger.error(
        `[GeofenceService] Failed to write cache for ${cacheKey}:`,
        error,
      );
    }
  }
}

/**
 * Invalidate geofence cache for a specific user.
 * Call when user-site assignments or geofence policy change.
 */
export async function clearGeofenceCache(userId: string): Promise<void> {
  try {
    await redis.del(`${GEOFENCE_CACHE_PREFIX}${userId}`);
  } catch (error) {
    logger.error(
      `[GeofenceService] Failed to clear cache for user ${userId}:`,
      error,
    );
  }
}
