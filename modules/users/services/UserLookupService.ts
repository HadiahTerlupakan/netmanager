import { UserRepository } from "../repositories/UserRepository";

export class UserLookupService {
  constructor(private readonly repository = new UserRepository()) {}

  /** Find user by id for cross-module read-only lookups. */
  findById(userId: string) {
    return this.repository.findById(userId);
  }

  /** Find user with geofence site data. */
  findUserWithSites(userId: string) {
    return this.repository.findUserWithSites(userId);
  }

  /** Find user geofence policy. */
  getGeofencePolicy(userId: string) {
    return this.repository.getGeofencePolicy(userId);
  }

  /** Find active users required for attendance processing. */
  findActiveForAttendance(
    tenantId: string,
    userId?: string,
    referenceDate?: Date,
  ) {
    return this.repository.findActiveForAttendance(
      tenantId,
      userId,
      referenceDate,
    );
  }

  /** Find active users with push token and schedule. */
  findActiveWithPushTokenAndSchedule() {
    return this.repository.findActiveWithPushTokenAndSchedule();
  }

  /** Find fixed-hour users for automatic absence marking. */
  findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
    return this.repository.findFixedHourUsersForAutoAlpha(referenceDate);
  }

  /** Find work schedule by user and tenant. */
  findWorkScheduleByIdWithTenant(userId: string, tenantId: string) {
    return this.repository.findWorkScheduleByIdWithTenant(userId, tenantId);
  }

  /** Find work schedule by user id. */
  findWorkScheduleById(userId: string) {
    return this.repository.findWorkScheduleById(userId);
  }

  /** Find attendance settings by user id. */
  findAttendanceSettingsById(userId: string) {
    return this.repository.findAttendanceSettingsById(userId);
  }

  /** Find multiple users with work configuration. */
  findManyWithWorkConfig(userIds: string[]) {
    return this.repository.findManyWithWorkConfig(userIds);
  }

  /** Find multiple users with basic display info. */
  findManyWithBasicInfo(userIds: string[]) {
    return this.repository.findManyWithBasicInfo(userIds);
  }

  /** Find multiple users with full attendance details. */
  findManyWithFullDetails(userIds: string[], tenantId?: string) {
    return this.repository.findManyWithFullDetails(userIds, tenantId);
  }

  /** Find user with assigned sites by id. */
  findWithSitesById(userId: string) {
    return this.repository.findWithSitesById(userId);
  }

  /** Find active users with push tokens by site. */
  findManyActiveWithPushTokenAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    return this.repository.findManyActiveWithPushTokenAndSite(
      departmentId,
      siteId,
      excludeUserId,
    );
  }
}

let userLookupServiceInstance: UserLookupService | null = null;

/** Return the shared user lookup facade lazily. */
export function getUserLookupService(): UserLookupService {
  if (!userLookupServiceInstance) {
    userLookupServiceInstance = new UserLookupService();
  }

  return userLookupServiceInstance;
}
