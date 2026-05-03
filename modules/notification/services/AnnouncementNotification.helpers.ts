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
const ADMIN_ROLE_NAMES = ["ADMIN", "SUPER_ADMIN"];
const ANNOUNCEMENT_LINK = "/announcement";

/** Send push notifications and persistent notifications for employees/admins. */
export async function sendEmployeeAnnouncementNotifications(
  announcement: AnnouncementRecord,
): Promise<void> {
  try {
    const targetAudience = announcement.target as TargetAudience;
    const users = await prisma.user.findMany({
      where: buildNotificationUserFilter(targetAudience),
      select: { id: true, pushToken: true },
    });
    const usersOnLeave = await findUsersOnLeave(users.map((user) => user.id));
    const tokens = users
      .filter((user) => !usersOnLeave.has(user.id))
      .map((user) => user.pushToken)
      .filter((token): token is string => !!token);

    if (tokens.length > 0) {
      const { sendExpoPushNotifications } = await import("@/lib/expo");
      await sendExpoPushNotifications(
        tokens,
        announcement.title,
        buildAnnouncementPreview(announcement.content),
        { announcementId: announcement.id, url: ANNOUNCEMENT_LINK },
      );
    }

    await createPersistentAnnouncementNotifications(
      announcement,
      buildNotificationDbUserFilter(targetAudience),
    );
  } catch (pushError) {
    logger.error(
      "[Announcements] Failed to send push notifications",
      pushError as Error,
    );
  }
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
    pushToken: { not: null },
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
    return { role: { name: { in: ADMIN_ROLE_NAMES } } };
  }
  return {};
}

async function findUsersOnLeave(userIds: string[]) {
  if (userIds.length === 0) {
    return new Set<string>();
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
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

function buildAnnouncementPreview(content: string) {
  const preview = content.substring(0, ANNOUNCEMENT_PREVIEW_LIMIT);
  return content.length > ANNOUNCEMENT_PREVIEW_LIMIT
    ? `${preview}...`
    : preview;
}
