import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  buildUserNotificationWhere,
  USER_NOTIFICATION_ADMIN_SELECT,
} from "./user-repository.helpers";

/** Ambil admin yang menerima approval berdasarkan tenant dan scope site. */
export function findAdminsForNotification(
  tenantId: string | null | undefined,
  userSiteId: string | null | undefined,
) {
  return prisma.user.findMany({
    where: buildUserNotificationWhere(tenantId, userSiteId),
    select: USER_NOTIFICATION_ADMIN_SELECT,
  });
}

/** Ambil user dasar beserta token push dan FCM token. */
export function findByIdWithPushToken(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, pushToken: true, fcmTokens: true },
  });
}

/** Ambil banyak user berdasarkan token push. */
export function findManyWithPushToken(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, pushToken: true },
  });
}

/** Ambil banyak user aktif per departemen yang punya push token. */
export function findManyByDepartmentWithPushToken(departmentId: string) {
  return prisma.user.findMany({
    where: { isActive: true, departmentId, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });
}

/** Ambil user dari daftar id yang masih memiliki push token. */
export function findManyWithPushTokenAndFilter(userIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: userIds }, pushToken: { not: null } },
    select: { id: true, pushToken: true },
  });
}

/** Ambil user aktif dengan token push berdasarkan site dan departemen. */
export function findManyActiveWithPushTokenAndSite(
  departmentId?: string,
  siteId?: string,
  excludeUserId?: string,
) {
  return prisma.user.findMany({
    where: buildActivePushTokenWhere(departmentId, siteId, excludeUserId),
    select: { id: true, fcmTokens: true, phone: true, name: true },
  });
}

/** Hapus token push yang invalid. */
export function clearPushTokens(tokens: string[]) {
  return prisma.user.updateMany({
    where: { pushToken: { in: tokens } },
    data: { pushToken: null },
  });
}

/** Ambil semua user aktif di tenant untuk broadcast notification. */
export function findAllActiveInTenant(tenantId: string) {
  return prisma.user.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

function buildActivePushTokenWhere(
  departmentId?: string,
  siteId?: string,
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    OR: [{ pushToken: { not: null } }, { fcmTokens: { isEmpty: false } }],
    ...(departmentId ? { departmentId } : {}),
    ...(siteId ? { siteId } : {}),
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
  };
}
