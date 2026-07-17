import { UserRepository } from "../repositories/UserRepository";
import { UserLookupRepository } from "../repositories/UserLookupRepository";

/** Menyediakan facade lookup user lintas modul tanpa memuat CRUD inti. */
export class UserLookupService {
  constructor(
    private readonly userRepository = new UserRepository(),
    private readonly lookupRepository = new UserLookupRepository(),
  ) {}

  /** Find user by id for cross-module read-only lookups. */
  findById(userId: string) {
    return this.userRepository.findById(userId);
  }

  /** Find user with geofence site data. */
  findUserWithSites(userId: string) {
    return this.lookupRepository.findUserWithSites(userId);
  }

  /** Find user geofence policy. */
  getGeofencePolicy(userId: string) {
    return this.lookupRepository.getGeofencePolicy(userId);
  }

  /** Find active users required for attendance processing. */
  findActiveForAttendance(
    tenantId: string,
    userId?: string,
    referenceDate?: Date,
  ) {
    return this.lookupRepository.findActiveForAttendance(
      tenantId,
      userId,
      referenceDate,
    );
  }

  /** Find active users with push token and schedule. */
  findActiveWithPushTokenAndSchedule() {
    return this.lookupRepository.findActiveWithPushTokenAndSchedule();
  }

  /** Find fixed-hour users for automatic absence marking. */
  findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
    return this.lookupRepository.findFixedHourUsersForAutoAlpha(referenceDate);
  }

  /** Find work schedule by user and tenant. */
  findWorkScheduleByIdWithTenant(userId: string, tenantId: string) {
    return this.lookupRepository.findWorkScheduleByIdWithTenant(
      userId,
      tenantId,
    );
  }

  /** Find work schedule by user id. */
  findWorkScheduleById(userId: string) {
    return this.lookupRepository.findWorkScheduleById(userId);
  }

  /** Find attendance settings by user id. */
  findAttendanceSettingsById(userId: string) {
    return this.lookupRepository.findAttendanceSettingsById(userId);
  }

  /** Find multiple users with work configuration. */
  findManyWithWorkConfig(userIds: string[]) {
    return this.lookupRepository.findManyWithWorkConfig(userIds);
  }

  /** Find multiple users with basic display info. */
  findManyWithBasicInfo(userIds: string[]) {
    return this.lookupRepository.findManyWithBasicInfo(userIds);
  }

  /** Find multiple users with full attendance details. */
  findManyWithFullDetails(userIds: string[], tenantId?: string) {
    return this.lookupRepository.findManyWithFullDetails(userIds, tenantId);
  }

  /** Find user with assigned sites by id. */
  findWithSitesById(userId: string) {
    return this.lookupRepository.findWithSitesById(userId);
  }

  /** Find user with basic site context by id. */
  findByIdWithSite(userId: string, tenantId?: string | null) {
    return this.lookupRepository.findByIdWithSite(userId, tenantId);
  }

  /** Find admins for notification delivery. */
  findAdminsForNotification(
    tenantId: string | null | undefined,
    userSiteId: string | null | undefined,
  ) {
    return this.lookupRepository.findAdminsForNotification(
      tenantId,
      userSiteId,
    );
  }

  /** Find user with department context. */
  findByIdWithDepartment(userId: string) {
    return this.lookupRepository.findByIdWithDepartment(userId);
  }

  /** Find user with push tokens for direct notifications. */
  findByIdWithPushToken(userId: string) {
    return this.lookupRepository.findByIdWithPushToken(userId);
  }

  /** Find users with custom where clause for notification targeting. */
  findManyWithCustomWhere(
    where: Parameters<UserLookupRepository["findManyWithCustomWhere"]>[0],
  ) {
    return this.lookupRepository.findManyWithCustomWhere(where);
  }

  /** Find users with detailed relations for notification targeting. */
  findManyWithDetailedRelations(
    where: Parameters<UserLookupRepository["findManyWithDetailedRelations"]>[0],
  ) {
    return this.lookupRepository.findManyWithDetailedRelations(where);
  }

  /** Find users by push token values. */
  findManyWithPushToken(tokens: string[]) {
    return this.lookupRepository.findManyWithPushToken(tokens);
  }

  /** Remove invalid push tokens from users. */
  clearPushTokens(tokens: string[]) {
    return this.lookupRepository.clearPushTokens(tokens);
  }

  /** Find users with push token among selected ids. */
  findManyWithPushTokenAndFilter(userIds: string[]) {
    return this.lookupRepository.findManyWithPushTokenAndFilter(userIds);
  }

  /** Find users by department with push token. */
  findManyByDepartmentWithPushToken(departmentId: string) {
    return this.lookupRepository.findManyByDepartmentWithPushToken(
      departmentId,
    );
  }

  /** Find active users with push tokens by site. */
  findManyActiveWithPushTokenAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    return this.lookupRepository.findManyActiveWithPushTokenAndSite(
      departmentId,
      siteId,
      excludeUserId,
    );
  }

  /** Find active users with phone by site (untuk WA). */
  findManyActiveWithPhoneAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    return this.lookupRepository.findManyActiveWithPhoneAndSite(
      departmentId,
      siteId,
      excludeUserId,
    );
  }

  /** Find all active users in tenant for broadcast notifications. */
  findAllActiveInTenant(tenantId: string) {
    return this.lookupRepository.findAllActiveInTenant(tenantId);
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
