import { Prisma } from "@prisma/client";

import {
  clearPushTokens,
  findAdminsForNotification,
  findByIdWithPushToken,
  findManyActiveWithPushTokenAndSite,
  findManyByDepartmentWithPushToken,
  findManyWithPushToken,
  findManyWithPushTokenAndFilter,
} from "./user-lookup.notification";
import {
  findActiveForAttendance,
  findActiveWithPushTokenAndSchedule,
  findAttendanceSettingsById,
  findFixedHourUsersForAutoAlpha,
  findUserWithSites,
  findWithSitesById,
  findWorkScheduleById,
  findWorkScheduleByIdWithTenant,
  getGeofencePolicy,
} from "./user-lookup.attendance";
import {
  findByIdWithDepartment,
  findByIdWithSite,
  findManyWithBasicInfo,
  findManyWithCustomWhere,
  findManyWithFullDetails,
  findManyWithWorkConfig,
} from "./user-lookup.profile";
import {
  findManyByDepartmentAndSite,
  findManyWithDetailedRelations,
} from "./user-lookup.workorder";

/** Menangani query lookup user lintas modul yang bersifat read-only. */
export class UserLookupRepository {
  findUserWithSites(userId: string) {
    return findUserWithSites(userId);
  }

  findByIdWithSite(id: string, tenantId?: string | null) {
    return findByIdWithSite(id, tenantId);
  }

  findAdminsForNotification(
    tenantId: string | null | undefined,
    userSiteId: string | null | undefined,
  ) {
    return findAdminsForNotification(tenantId, userSiteId);
  }

  findWorkScheduleById(userId: string) {
    return findWorkScheduleById(userId);
  }

  getGeofencePolicy(userId: string): Promise<string | null> {
    return getGeofencePolicy(userId);
  }

  findActiveForAttendance(
    tenantId: string,
    userId?: string,
    referenceDate?: Date,
  ) {
    return findActiveForAttendance(tenantId, userId, referenceDate);
  }

  findActiveWithPushTokenAndSchedule() {
    return findActiveWithPushTokenAndSchedule();
  }

  findFixedHourUsersForAutoAlpha(referenceDate?: Date) {
    return findFixedHourUsersForAutoAlpha(referenceDate);
  }

  findWorkScheduleByIdWithTenant(userId: string, tenantId: string) {
    return findWorkScheduleByIdWithTenant(userId, tenantId);
  }

  findAttendanceSettingsById(userId: string) {
    return findAttendanceSettingsById(userId);
  }

  findManyWithWorkConfig(userIds: string[]) {
    return findManyWithWorkConfig(userIds);
  }

  findManyWithBasicInfo(userIds: string[]) {
    return findManyWithBasicInfo(userIds);
  }

  findManyWithFullDetails(userIds: string[], tenantId?: string) {
    return findManyWithFullDetails(userIds, tenantId);
  }

  findWithSitesById(userId: string) {
    return findWithSitesById(userId);
  }

  findManyWithPushToken(userIds: string[]) {
    return findManyWithPushToken(userIds);
  }

  findManyByDepartmentWithPushToken(departmentId: string) {
    return findManyByDepartmentWithPushToken(departmentId);
  }

  findByIdWithDepartment(userId: string) {
    return findByIdWithDepartment(userId);
  }

  findManyActiveWithPushTokenAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    return findManyActiveWithPushTokenAndSite(
      departmentId,
      siteId,
      excludeUserId,
    );
  }

  findByIdWithPushToken(userId: string) {
    return findByIdWithPushToken(userId);
  }

  findManyWithPushTokenAndFilter(userIds: string[]) {
    return findManyWithPushTokenAndFilter(userIds);
  }

  clearPushTokens(tokens: string[]) {
    return clearPushTokens(tokens);
  }

  findManyWithCustomWhere(where: Prisma.UserWhereInput) {
    return findManyWithCustomWhere(where);
  }

  findManyWithDetailedRelations(where: Prisma.UserWhereInput) {
    return findManyWithDetailedRelations(where);
  }

  findManyByDepartmentAndSite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ) {
    return findManyByDepartmentAndSite(departmentId, siteId, excludeUserId);
  }
}
