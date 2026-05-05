import { logger } from "@/lib/logger";
import { socketEmitter } from "@/lib/websocket/emitter";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
import {
  sendPushNotification as sendExpoPush,
  sendPushToDepartment as sendExpoPushToDepartment,
} from "./ExpoPushService";
import {
  buildAdminNotificationSiteId,
  buildNotificationPushMetadata,
  buildWebsocketPayload,
  shouldNotifyAdmins,
} from "./NotificationService.helpers";
import type { CreateNotificationData } from "./NotificationService.types";
import type { UserLookupService } from "@/modules/users";

/** Dispatch websocket, FCM, and Expo deliveries for one notification. */
export async function deliverNotification(input: {
  notification: {
    id: string;
    type: string;
    priority: string;
    title: string;
    message: string;
    link: string | null;
    createdAt: Date;
  };
  data: CreateNotificationData;
  userLookupService: UserLookupService;
}): Promise<void> {
  const deliveryPayload = buildDeliveryPayload(input.notification, input.data);
  await notifyNotificationChannels(
    input.data,
    deliveryPayload,
    input.userLookupService,
  );
}

async function notifyNotificationChannels(
  data: CreateNotificationData,
  deliveryPayload: ReturnType<typeof buildDeliveryPayload>,
  userLookupService: UserLookupService,
) {
  await notifyDirectUser(
    data,
    deliveryPayload.wsPayload,
    deliveryPayload.pushMetadata,
    userLookupService,
  );
  await notifyDepartment(
    data,
    deliveryPayload.wsPayload,
    deliveryPayload.pushMetadata,
    userLookupService,
  );
  await notifyAdmins(
    data,
    deliveryPayload.wsPayload,
    deliveryPayload.pushMetadata,
  );
}

function buildDeliveryPayload(
  notification: {
    id: string;
    type: string;
    priority: string;
    title: string;
    message: string;
    link: string | null;
    createdAt: Date;
  },
  data: CreateNotificationData,
) {
  return {
    wsPayload: buildWebsocketPayload(notification),
    pushMetadata: buildNotificationPushMetadata(notification.id, data),
  };
}

/** Notify one direct user through all supported channels. */
async function notifyDirectUser(
  data: CreateNotificationData,
  wsPayload: ReturnType<typeof buildWebsocketPayload>,
  pushMetadata: ReturnType<typeof buildNotificationPushMetadata>,
  userLookupService: UserLookupService,
): Promise<void> {
  if (!data.userId) {
    return;
  }

  socketEmitter.notifyUser(data.userId, wsPayload);
  const directRecipient = await userLookupService.findByIdWithPushToken(
    data.userId,
  );
  const fcmTokens = directRecipient?.fcmTokens ?? [];
  if (fcmTokens.length > 0) {
    void sendFCMNotification(
      fcmTokens,
      data.title,
      data.message,
      pushMetadata,
    ).catch((error) => logger.error("[FCM Push] Error:", error));
  }

  if (data.skipExpoPush) {
    return;
  }

  void sendExpoPush(data.userId, data.title, data.message, {
    link: data.link || undefined,
    sourceType: data.sourceType || undefined,
    sourceId: data.sourceId || undefined,
  }).catch((error) => logger.error("[Expo Push] Error:", error));
}

/** Notify all department recipients through supported channels. */
async function notifyDepartment(
  data: CreateNotificationData,
  wsPayload: ReturnType<typeof buildWebsocketPayload>,
  pushMetadata: ReturnType<typeof buildNotificationPushMetadata>,
  userLookupService: UserLookupService,
): Promise<void> {
  if (!data.departmentId) {
    return;
  }

  socketEmitter.notifyDepartment(data.departmentId, wsPayload);
  const departmentRecipients =
    await userLookupService.findManyActiveWithPushTokenAndSite(
      data.departmentId,
      data.siteId,
    );
  const departmentFcmTokens = departmentRecipients.flatMap(
    (recipient) => recipient.fcmTokens ?? [],
  );

  if (departmentFcmTokens.length > 0) {
    void sendFCMNotification(
      departmentFcmTokens,
      data.title,
      data.message,
      pushMetadata,
    ).catch((error) => logger.error("[FCM Push Dept] Error:", error));
  }

  if (data.skipExpoPush) {
    return;
  }

  void sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
    link: data.link || undefined,
    sourceType: data.sourceType || undefined,
    sourceId: data.sourceId || undefined,
  }).catch((error) => logger.error("[Expo Push Dept] Error:", error));
}

/** Notify admin channels for high-priority notifications. */
async function notifyAdmins(
  data: CreateNotificationData,
  wsPayload: ReturnType<typeof buildWebsocketPayload>,
  pushMetadata: ReturnType<typeof buildNotificationPushMetadata>,
): Promise<void> {
  if (!shouldNotifyAdmins(data)) {
    return;
  }

  socketEmitter.notifyAdmins(
    wsPayload,
    buildAdminNotificationSiteId(data.siteId),
  );
  const adminTokens = await getAdminTokens();
  if (adminTokens.length === 0) {
    return;
  }

  void sendFCMNotification(
    adminTokens,
    data.title,
    data.message,
    pushMetadata,
  ).catch((error) => logger.error("[FCM Push Admin] Error:", error));
}
