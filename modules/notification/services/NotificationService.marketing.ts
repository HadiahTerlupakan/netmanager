import { logger } from "@/lib/logger";
import {
  buildCanvasingTitle,
  buildPointClaimTitle,
  type RecipientUser,
} from "./NotificationService.helpers";
import type {
  CanvasingNotificationData,
  CreateNotificationData,
  PointClaimNotificationData,
} from "./NotificationService.types";

const DEFAULT_SALES_NAME = "Sales";

/** Notify canvasing verifiers about a new canvasing request. */
export async function notifyNewCanvasingRecipients(input: {
  data: CanvasingNotificationData;
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number } | null> {
  if (input.recipients.length === 0) {
    logger.warn("[NotificationDebug] NO RECIPIENTS FOUND for New Canvasing.");
    return null;
  }

  await notifyMarketingRecipients(
    input.recipients,
    input.createNotification,
    (recipient) => buildCanvasingNotification(input.data, recipient.id),
  );
  return { count: input.recipients.length };
}

/** Notify canvasing verifiers about a new point claim. */
export async function notifyNewPointClaimRecipients(input: {
  data: PointClaimNotificationData;
  recipients: RecipientUser[];
  createNotification: (data: CreateNotificationData) => Promise<unknown>;
}): Promise<{ count: number } | null> {
  const filteredRecipients = input.recipients.filter(
    (recipient) => recipient.id !== input.data.salesId,
  );
  if (filteredRecipients.length === 0) {
    return null;
  }

  await notifyMarketingRecipients(
    filteredRecipients,
    input.createNotification,
    (recipient) => buildPointClaimNotification(input.data, recipient.id),
  );
  return { count: filteredRecipients.length };
}

async function notifyMarketingRecipients(
  recipients: RecipientUser[],
  createNotification: (data: CreateNotificationData) => Promise<unknown>,
  buildNotification: (recipient: RecipientUser) => CreateNotificationData,
) {
  await Promise.all(
    recipients.map((recipient) =>
      createNotification(buildNotification(recipient)),
    ),
  );
}

function buildCanvasingNotification(
  data: CanvasingNotificationData,
  userId: string,
): CreateNotificationData {
  return {
    type: "ANNOUNCEMENT",
    priority: "NORMAL",
    title: buildCanvasingTitle(),
    message: `Request canvasing baru untuk ${data.customerName} dari ${data.salesName || DEFAULT_SALES_NAME}`,
    link: `/admin/marketing/canvasing/${data.canvasingId}`,
    userId,
    siteId: data.siteId || undefined,
    sourceType: "CANVASING",
    sourceId: data.canvasingId,
  };
}

function buildPointClaimNotification(
  data: PointClaimNotificationData,
  userId: string,
): CreateNotificationData {
  return {
    type: "ANNOUNCEMENT",
    priority: "NORMAL",
    title: buildPointClaimTitle(),
    message: `${data.salesName || DEFAULT_SALES_NAME} mengajukan claim +${data.pointValue} poin untuk canvasing ${data.customerName}`,
    link: `/admin/marketing/canvasing/${data.canvasingId}`,
    userId,
    siteId: data.siteId || undefined,
    sourceType: "POINT_CLAIM",
    sourceId: data.claimId,
  };
}
