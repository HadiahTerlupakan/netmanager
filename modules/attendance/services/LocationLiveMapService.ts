import { getTenantIdFromContext } from "@/lib/tenant-context";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { getTimezone } from "@/lib/utils/get-timezone";
import { AttendanceRepository } from "../repositories/AttendanceRepository";
import type { ILocationTrackingRepository } from "../domain/ports/ILocationTrackingRepository";

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

export class LocationLiveMapService {
  constructor(
    private readonly attendanceRepo: AttendanceRepository,
    private readonly locationRepo: ILocationTrackingRepository,
  ) {}

  /** Ambil lokasi terakhir untuk karyawan yang sedang aktif. */
  async getLiveLocations(filters?: { siteId?: string; departmentId?: string }) {
    const { tenantId, isSuperAdmin } = await getTenantIdFromContext();
    if (!isSuperAdmin && !tenantId) return [];
    const activeAttendances = await this.getActiveAttendances(
      tenantId || undefined,
      filters,
    );
    if (activeAttendances.length === 0) return [];

    const latestLocations = await this.locationRepo.getLatestLocationsForUsers(
      activeAttendances.map((attendance) => attendance.userId),
      tenantId,
      isSuperAdmin,
    );
    const locationMap = new Map(
      latestLocations.map((location) => [location.userId, location]),
    );

    return activeAttendances
      .map((attendance) => this.mapLiveLocation(attendance, locationMap))
      .filter(
        (location): location is NonNullable<typeof location> =>
          location !== null,
      );
  }

  private async getActiveAttendances(
    tenantId: string | undefined,
    filters?: { siteId?: string; departmentId?: string },
  ) {
    const timezone = await getTimezone(tenantId);
    const todayUTC = toStartOfDay(new Date(), timezone);
    const userFilter = this.buildUserFilter(filters);

    return (await this.attendanceRepo.findMany({
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
  }

  private buildUserFilter(filters?: {
    siteId?: string;
    departmentId?: string;
  }) {
    return {
      ...(filters?.siteId ? { siteId: filters.siteId } : {}),
      ...(filters?.departmentId ? { departmentId: filters.departmentId } : {}),
    };
  }

  private mapLiveLocation(
    attendance: ActiveAttendanceWithUser,
    locationMap: Map<
      string,
      {
        latitude: number;
        longitude: number;
        accuracy: number | null;
        speed: number | null;
        heading: number | null;
        isMoving: boolean;
        batteryLevel: number | null;
        recordedAt: Date;
      }
    >,
  ) {
    const location = locationMap.get(attendance.userId);
    if (!location) return null;
    return {
      userId: attendance.userId,
      userName: attendance.user.name || "Unknown",
      userImage: attendance.user.image,
      siteName: attendance.user.sites?.name || null,
      departmentName: attendance.user.departments?.name || null,
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
  }
}
