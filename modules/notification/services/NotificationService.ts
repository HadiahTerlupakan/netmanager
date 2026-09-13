import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserLookupService } from "@/modules/users";
import { deliverNotification } from "./NotificationService.delivery";
import { buildNotificationCreateData } from "./NotificationService.helpers";
import {
  notifyNewCanvasingRecipients,
  notifyNewPointClaimRecipients,
} from "./NotificationService.marketing";
import {
  buildHolidayNotificationLink,
  buildHolidayNotificationMessage,
  buildHolidayNotificationTitle,
  type HolidayNotificationData,
} from "./NotificationService.holiday";
import {
  findCanvasingVerifiers,
  findPelangganManagers,
} from "./NotificationService.recipients";
import type {
  CanvasingNotificationData,
  CreateNotificationData,
  NotificationType,
  PackageUpgradeCancelledNotificationData,
  PackageUpgradeNotificationData,
  PointClaimNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService.types";
import {
  notifyAdminsAboutMobileActionEvent,
  notifyNewWorkOrderEvent,
  notifyWorkOrderAssignedEvent,
  notifyWorkOrderStatusChangeEvent,
  notifyWorkOrderUpdateEvent,
} from "./NotificationService.work-order-events";
import {
  getNotificationsForUserAccess,
  getReadableNotificationForUserAccess,
  getUnreadCountAccess,
  markAllAsReadAccess,
} from "./NotificationService.access";
import { getTenantIdFromContext } from "@/lib/tenant-context";

function getNotificationRepository() {
  return new NotificationRepository();
}

function getUserLookupService() {
  return new UserLookupService();
}

export async function createNotification(data: CreateNotificationData) {
  const tenantContext = data.tenantId ? null : await getTenantIdFromContext();
  const tenantId = data.tenantId ?? tenantContext?.tenantId ?? null;
  const notification = await getNotificationRepository().createFull(
    buildNotificationCreateData(data, tenantId),
  );

  await deliverNotification({
    notification,
    data: { ...data, tenantId: tenantId ?? undefined },
    userLookupService: getUserLookupService(),
  });

  return notification;
}

export async function notifyNewWorkOrder(
  data: WorkOrderNotificationData & { triggeredByUserId?: string },
) {
  return notifyNewWorkOrderEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderAssigned(
  data: WorkOrderNotificationData & {
    assigneeName?: string;
    triggeredByUserId?: string;
  },
) {
  await notifyWorkOrderAssignedEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderStatusChange(
  data: WorkOrderNotificationData & {
    oldStatus: string;
    newStatus: string;
    triggeredByUserId?: string;
  },
) {
  await notifyWorkOrderStatusChangeEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyWorkOrderUpdate(
  data: WorkOrderNotificationData & {
    updateMessage: string;
    updatedByName?: string;
    triggeredByUserId?: string;
    excludeUserIds?: string[];
  },
) {
  await notifyWorkOrderUpdateEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function notifyAdminsAboutMobileAction(data: {
  workOrderId: string;
  workOrderNumber: string;
  title: string;
  actionType: string;
  actionMessage: string;
  triggeredByUserId: string;
  triggeredByName?: string;
  departmentId?: string;
  siteId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
}) {
  return notifyAdminsAboutMobileActionEvent({
    data,
    createNotification,
    userLookupService: getUserLookupService(),
  });
}

export async function getNotificationsForUser(
  userId: string,
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
    type?: NotificationType;
    excludeTypes?: NotificationType[];
    siteId?: string;
    departmentId?: string;
    includeTotal?: boolean;
  },
) {
  return getNotificationsForUserAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    userId,
    options,
  });
}

export async function getReadableNotificationForUser(
  notificationId: string,
  userId: string,
  options?: { departmentId?: string; siteId?: string },
) {
  return getReadableNotificationForUserAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    notificationId,
    userId,
    options,
  });
}

export async function getUnreadCount(
  userId: string,
  excludeTypes?: NotificationType[],
  siteId?: string,
  departmentId?: string,
): Promise<number> {
  return getUnreadCountAccess({
    repository: getNotificationRepository(),
    userId,
    excludeTypes,
    siteId,
    departmentId,
  });
}

export async function markAsRead(notificationId: string) {
  return getNotificationRepository().markAsRead(notificationId);
}

export async function markAllAsRead(
  userId: string,
  type?: NotificationType,
  siteId?: string,
) {
  return markAllAsReadAccess({
    repository: getNotificationRepository(),
    userLookupService: getUserLookupService(),
    userId,
    type,
    siteId,
  });
}

export async function notifyNewCanvasing(data: CanvasingNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: getUserLookupService(),
    siteId: data.siteId,
  });

  return notifyNewCanvasingRecipients({
    data,
    recipients,
    createNotification,
  });
}

export async function notifyNewPointClaim(data: PointClaimNotificationData) {
  const recipients = await findCanvasingVerifiers({
    userLookupService: getUserLookupService(),
    siteId: data.siteId,
  });

  return notifyNewPointClaimRecipients({
    data,
    recipients,
    createNotification,
  });
}

export async function notifyHolidayCreated(
  data: HolidayNotificationData,
): Promise<void> {
  const userLookupService = getUserLookupService();

  const activeUsers = await userLookupService.findAllActiveInTenant(
    data.tenantId,
  );

  const title = buildHolidayNotificationTitle();
  const message = buildHolidayNotificationMessage(
    data.holidayName,
    data.holidayDate,
    data.description,
  );
  const link = buildHolidayNotificationLink();

  const notificationPayload = activeUsers.map((user: { id: string }) => ({
    type: "HOLIDAY_CREATED" as const,
    priority: "NORMAL" as const,
    title,
    message,
    link,
    userId: user.id,
    sourceType: "Holiday",
    sourceId: data.holidayId,
    tenantId: data.tenantId,
  }));

  // Batched fan-out — hindari connection-pool exhaustion saat tenant punya
  // banyak active user. 50 sekaligus aman untuk pool default Prisma.
  const BATCH_SIZE = 50;
  for (let i = 0; i < notificationPayload.length; i += BATCH_SIZE) {
    const slice = notificationPayload.slice(i, i + BATCH_SIZE);
    await Promise.all(slice.map((payload) => createNotification(payload)));
  }
}

/**
 * Beri tahu pengelola pelanggan bahwa ada pengajuan upgrade paket dari portal.
 *
 * Notifikasi tersimpan di tabel `Notifications` supaya tetap terlihat di bell
 * admin walaupun tidak ada yang sedang online saat pengajuan masuk.
 */
export async function notifyPackageUpgradeRequested(
  data: PackageUpgradeNotificationData,
): Promise<void> {
  const applyAtLabel = data.applyAt.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  await fanOutPackageUpgradeNotification({
    customerId: data.customerId,
    siteId: data.siteId,
    tenantId: data.tenantId,
    title: "Pengajuan upgrade paket",
    message: `${data.customerName} mengajukan upgrade dari ${data.currentPackageName} ke ${data.targetPackageName}, berlaku ${applyAtLabel}.`,
  });
}

/**
 * Beri tahu pengelola pelanggan bahwa pengajuan upgrade dibatalkan pelanggan.
 *
 * Penting dikirim karena mereka sudah menerima notifikasi pengajuannya — tanpa
 * ini mereka bertindak atas informasi yang sudah basi.
 */
export async function notifyPackageUpgradeCancelled(
  data: PackageUpgradeCancelledNotificationData,
): Promise<void> {
  await fanOutPackageUpgradeNotification({
    customerId: data.customerId,
    siteId: data.siteId,
    tenantId: data.tenantId,
    title: "Pengajuan upgrade dibatalkan",
    message: `${data.customerName} membatalkan pengajuan upgrade ke ${data.targetPackageName}.`,
  });
}

/** Kirim notifikasi terkait upgrade paket ke seluruh pengelola pelanggan. */
async function fanOutPackageUpgradeNotification(input: {
  customerId: string;
  siteId?: string | null;
  tenantId?: string | null;
  title: string;
  message: string;
}): Promise<void> {
  const recipients = await findPelangganManagers({
    userLookupService: getUserLookupService(),
    siteId: input.siteId,
  });

  await Promise.all(
    recipients.map((recipient: { id: string }) =>
      createNotification({
        type: "PACKAGE_UPGRADE",
        priority: "NORMAL",
        title: input.title,
        message: input.message,
        link: `/admin/pelanggan/ppp/${input.customerId}`,
        userId: recipient.id,
        siteId: input.siteId ?? undefined,
        sourceType: "PackageUpgradeRequest",
        sourceId: input.customerId,
        tenantId: input.tenantId ?? undefined,
      }),
    ),
  );
}

export type {
  CanvasingNotificationData,
  CreateNotificationData,
  NotificationPriority,
  NotificationType,
  PackageUpgradeCancelledNotificationData,
  PackageUpgradeNotificationData,
  PointClaimNotificationData,
  WorkOrderNotificationData,
} from "./NotificationService.types";
export type { HolidayNotificationData } from "./NotificationService.holiday";
