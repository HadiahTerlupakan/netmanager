import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES, requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import {
  NotificationDispatcher,
  type BillingTemplateKey,
} from "@/modules/notification";

const SOURCE = "CustomerNotificationHandler";

const EVENT_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.CUSTOMER_CREATED]: "customerWelcome",
  [EVENT_NAMES.CUSTOMER_ISOLATED]: "customerIsolated",
  [EVENT_NAMES.CUSTOMER_ACTIVATED]: "customerActivated",
  [EVENT_NAMES.PACKAGE_CHANGED]: "packageChanged",
};

/**
 * Handler yang subscribe ke event customer lifecycle dan dispatch
 * notifikasi multi-channel (WA/Email/Push/In-App) via NotificationDispatcher.
 * Independent dari handler sync MikroTik — kedua handler berjalan paralel untuk event yang sama.
 */
export async function handleCustomerNotification(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const templateKey = EVENT_TEMPLATE_MAP[eventName];
  if (!templateKey) {
    logger.debug(
      `[CustomerNotificationHandler] Skip unrecognized event ${eventName}`,
    );
    return;
  }

  const pelangganId = requirePayloadString(
    payload.customerId,
    "customerId",
    SOURCE,
  );
  const customerName =
    typeof payload.customerName === "string" ? payload.customerName : "";
  const username =
    typeof payload.username === "string" ? payload.username : undefined;
  const packageName =
    typeof payload.packageName === "string" ? payload.packageName : undefined;

  await new NotificationDispatcher().dispatch({
    pelangganId,
    templateKey,
    params: { customerName, username, packageName },
    sourceType: "CUSTOMER_LIFECYCLE",
    sourceId: pelangganId,
    // Idempotency: BullMQ retry pakai job.id sama, jadi dedupeKey stabil
    // antar attempt — cegah double-send saat job di-retry.
    dedupeKey: job.id ? `${eventName}:${job.id}` : undefined,
  });
}
