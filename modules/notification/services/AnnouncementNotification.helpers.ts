import crypto from "crypto";
/**
 * NOTE: Prisma import is intentionally kept here for type safety.
 * This helper uses Prisma types for user query building and filtering.
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import type { TargetAudience } from "../types/notification.enums";
import type { AnnouncementRecord } from "./AnnouncementService.helpers";

const ANNOUNCEMENT_PREVIEW_LIMIT = 100;
const EMPLOYEE_ROLE_NAMES = ["EMPLOYEE", "TEKNISI"];
const ANNOUNCEMENT_LINK = "/announcement";

/** Send push notifications and persistent notifications for employees/admins. */
export async function sendEmployeeAnnouncementNotifications(
  announcement: AnnouncementRecord,
): Promise<void> {
  try {
    const targetAudience = announcement.target as TargetAudience;
    await pushAnnouncementToTenantDevices(announcement, targetAudience);
    await createPersistentAnnouncementNotifications(announcement, {
      ...buildNotificationDbUserFilter(targetAudience),
      ...tenantFilter(announcement),
    });
  } catch (pushError) {
    logger.error(
      "[Announcements] Failed to send push notifications",
      pushError as Error,
    );
  }
}

/**
 * Push pengumuman ke HP karyawan tenant pengumuman itu, kecuali yang cuti.
 * Pengumuman tanpa tenant tidak di-push: penerimanya tidak bisa dibatasi ke
 * satu tenant, dan push lintas tenant lebih buruk daripada tidak ada push.
 */
async function pushAnnouncementToTenantDevices(
  announcement: AnnouncementRecord,
  targetAudience: TargetAudience,
): Promise<void> {
  if (!announcement.tenantId) {
    logger.warn(
      "[Announcements] Push dilewati: pengumuman tanpa tenantId (cegah push lintas tenant)",
      { announcementId: announcement.id },
    );
    return;
  }

  const users = await prisma.user.findMany({
    where: {
      ...buildNotificationUserFilter(targetAudience),
      ...tenantFilter(announcement),
    },
    select: { id: true },
  });
  const usersOnLeave = await findUsersOnLeave(users.map((user) => user.id));
  const recipients = users
    .filter((user) => !usersOnLeave.has(user.id))
    .map((user) => ({ type: "user", id: user.id }));
  if (recipients.length === 0) return;

  // Dimuat saat dipakai: modul ini diimpor banyak tempat (lewat
  // AnnouncementService.helpers), dan pengirim FCM menarik Firebase Admin.
  const { sendPushToActors } = await import("./ActorPushService");
  await sendPushToActors(
    recipients,
    announcement.title,
    buildAnnouncementPreview(announcement.content),
    { announcementId: announcement.id, url: ANNOUNCEMENT_LINK },
  );
}

/** Batasi penerima ke tenant pengumuman, bila pengumuman punya tenant. */
function tenantFilter(announcement: AnnouncementRecord): Prisma.UserWhereInput {
  return announcement.tenantId ? { tenantId: announcement.tenantId } : {};
}

async function createPersistentAnnouncementNotifications(
  announcement: AnnouncementRecord,
  where: Prisma.UserWhereInput,
) {
  const targetedUsers = await prisma.user.findMany({
    where,
    select: { id: true },
  });
  if (targetedUsers.length === 0) {
    return;
  }

  await prisma.notifications.createMany({
    data: targetedUsers.map((user) => ({
      id: crypto.randomUUID(),
      type: "ANNOUNCEMENT",
      title: announcement.title,
      message: buildAnnouncementPreview(announcement.content),
      userId: user.id,
      sourceType: "ANNOUNCEMENT",
      sourceId: announcement.id,
      isRead: false,
      priority: "NORMAL",
      createdAt: new Date(),
    })),
  });
}

function buildNotificationUserFilter(
  target: TargetAudience,
): Prisma.UserWhereInput {
  return {
    fcmTokens: { isEmpty: false },
    isActive: true,
    ...buildRoleFilter(target),
  };
}

function buildNotificationDbUserFilter(
  target: TargetAudience,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...buildRoleFilter(target),
  };
}

function buildRoleFilter(target: TargetAudience): Prisma.UserWhereInput {
  if (target === "EMPLOYEE") {
    return { role: { name: { in: EMPLOYEE_ROLE_NAMES } } };
  }
  if (target === "ADMIN") {
    return { role: { is: { accessAdminPanel: true } } };
  }
  return {};
}

async function findUsersOnLeave(userIds: string[]) {
  if (userIds.length === 0) {
    return new Set<string>();
  }

  const { now, startOfToday } = buildLeaveRangeBounds();
  const usersOnLeave = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: startOfToday },
      userId: { in: userIds },
    },
    select: { userId: true },
  });
  return new Set(usersOnLeave.map((user) => user.userId));
}

function buildLeaveRangeBounds() {
  const now = new Date();
  return {
    now,
    startOfToday: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
  };
}

function buildAnnouncementPreview(content: string) {
  const preview = content.substring(0, ANNOUNCEMENT_PREVIEW_LIMIT);
  return content.length > ANNOUNCEMENT_PREVIEW_LIMIT
    ? `${preview}...`
    : preview;
}
