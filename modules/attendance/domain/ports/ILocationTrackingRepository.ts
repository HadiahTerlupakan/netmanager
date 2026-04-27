import type {
  EmployeeLocationEntity,
  LocationDataEntity,
} from "../entities/LocationTrackingEntity";

export interface ILocationTrackingRepository {
  /** Persist a single location point. */
  createLocation(
    userId: string,
    tenantId: string | null | undefined,
    data: LocationDataEntity,
  ): Promise<EmployeeLocationEntity>;

  /** Persist multiple location points. */
  createLocationsBatch(
    userId: string,
    tenantId: string | null | undefined,
    locations: LocationDataEntity[],
  ): Promise<{ count: number }>;

  /** Read latest location for each user. */
  getLatestLocationsForUsers(
    userIds: string[],
    effectiveTenantId: string | null | undefined,
    isSuperAdmin: boolean,
  ): Promise<EmployeeLocationEntity[]>;

  /** Read user location history in a date range. */
  findLocationsByUserIdAndDateRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<EmployeeLocationEntity[]>;

  /** Delete historical locations before cutoff date. */
  deleteLocationsBefore(date: Date): Promise<{ count: number }>;
}
