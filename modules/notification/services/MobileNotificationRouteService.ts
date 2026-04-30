import {
  getNotificationsForUser,
  getReadableNotificationForUser,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./NotificationService";

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 50;
const DEFAULT_CURSOR = 0;
const MARKETING_APP_PATH = "/(app)/marketing/canvasing";

interface MobileNotificationAuthPayload {
  userId: string;
  permissions?: string[];
  siteId?: string | null;
}

interface MobileNotificationListInput {
  userId: string;
  limit: number;
  cursor: number;
  siteId?: string;
}

interface MobileNotificationActionInput {
  action: string;
  notificationId?: string;
  userId: string;
  siteId?: string;
}

/** Parse safe notification pagination params for mobile route. */
export function parseMobileNotificationPagination(
  searchParams: URLSearchParams,
) {
  const limitParam = Number.parseInt(
    searchParams.get("limit") || String(DEFAULT_LIMIT),
    10,
  );
  const cursorParam = Number.parseInt(
    searchParams.get("cursor") || String(DEFAULT_CURSOR),
    10,
  );

  return {
    limit: Number.isNaN(limitParam)
      ? DEFAULT_LIMIT
      : Math.min(Math.max(limitParam, 1), MAX_LIMIT),
    cursor: Number.isNaN(cursorParam)
      ? DEFAULT_CURSOR
      : Math.max(cursorParam, DEFAULT_CURSOR),
  };
}

/** Resolve site filter for mobile notification access. */
export function resolveMobileNotificationSiteId(
  authPayload: MobileNotificationAuthPayload,
) {
  const permissions = Array.isArray(authPayload.permissions)
    ? authPayload.permissions
    : [];

  return permissions.includes("site_only")
    ? authPayload.siteId || undefined
    : undefined;
}

/** Build mobile notification list payload. */
export async function getMobileNotifications(
  input: MobileNotificationListInput,
) {
  const { notifications, total } = await getNotificationsForUser(input.userId, {
    limit: input.limit,
    offset: input.cursor,
    siteId: input.siteId,
  });
  const unreadCount = await getUnreadCount(
    input.userId,
    undefined,
    input.siteId,
  );

  return {
    notifications: notifications.map((notification) =>
      formatMobileNotification(notification),
    ),
    unreadCount,
    nextCursor:
      input.cursor + notifications.length < total
        ? String(input.cursor + notifications.length)
        : null,
  };
}

/** Execute mobile notification mutation action. */
export async function handleMobileNotificationAction(
  input: MobileNotificationActionInput,
) {
  if (input.action === "markAllRead") {
    await markAllAsRead(input.userId, undefined, input.siteId);
    return { success: true, message: "Semua notifikasi ditandai sudah dibaca" };
  }

  if (input.action === "markRead" && input.notificationId) {
    const notification = await getReadableNotificationForUser(
      input.notificationId,
      input.userId,
      { siteId: input.siteId },
    );
    if (!notification) {
      return {
        success: false as const,
        status: 404,
        error: "Notifikasi tidak ditemukan",
      };
    }

    await markAsRead(input.notificationId);
    return { success: true, message: "Notifikasi ditandai sudah dibaca" };
  }

  return { success: false as const, status: 400, error: "Aksi tidak valid" };
}

/** Format one notification into mobile response DTO. */
function formatMobileNotification(notification: {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}) {
  const normalizedCopy = normalizeMobileNotificationCopy(notification);
  return {
    ...buildMobileNotificationBase(notification),
    title: normalizedCopy.title,
    message: normalizedCopy.message,
    link: resolveMobileNotificationLink(notification),
  };
}

function buildMobileNotificationBase(notification: {
  id: string;
  type: string;
  isRead: boolean;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    type: notification.type,
    isRead: notification.isRead,
    sourceType: notification.sourceType,
    sourceId: notification.sourceId,
    createdAt: notification.createdAt.toISOString(),
  };
}

/** Resolve mobile app link by notification source type. */
function resolveMobileNotificationLink(notification: {
  sourceType: string | null;
  sourceId: string | null;
  link: string | null;
}) {
  if (notification.sourceType === "WORK_ORDER" && notification.sourceId) {
    return `/(app)/work-order-detail/${notification.sourceId}`;
  }
  if (notification.sourceType === "LEAVE") return "/(app)/izin";
  if (notification.sourceType === "OVERTIME") return "/(app)/lembur";
  if (notification.sourceType === "ATTENDANCE") return "/(app)/absensi";
  if (
    notification.sourceType === "CANVASING" ||
    notification.sourceType === "POINT_CLAIM"
  ) {
    return normalizeMarketingLink(notification.link);
  }
  if (notification.sourceType === "INVENTORY") return "/(app)/barang";
  return notification.link;
}

/** Normalize marketing path for mobile app route. */
function normalizeMarketingLink(rawLink: string | null) {
  if (!rawLink) return MARKETING_APP_PATH;
  if (rawLink.startsWith(MARKETING_APP_PATH)) return rawLink;
  if (rawLink.startsWith("/admin/marketing/canvasing")) {
    return rawLink.replace("/admin/marketing/canvasing", MARKETING_APP_PATH);
  }
  if (rawLink.startsWith("/marketing/canvasing")) {
    return rawLink.replace("/marketing/canvasing", MARKETING_APP_PATH);
  }
  return rawLink;
}

/** Normalize notification title and message for mobile clients. */
function normalizeMobileNotificationCopy(notification: {
  title: string;
  message: string;
  sourceType: string | null;
}) {
  if (notification.sourceType !== "WORK_ORDER") {
    return {
      title: notification.title,
      message: notification.message,
    };
  }

  const title =
    notification.title === "📝 WO Request Baru"
      ? "Work Order Baru"
      : notification.title.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const message = notification.message.replace(/^[^:]+ mengajukan:\s*/u, "");

  return { title, message };
}
