import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES, requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import {
  NotificationDispatcher,
  type BillingTemplateKey,
  type BillingTemplateParams,
} from "@/modules/notification";

const SOURCE = "CustomerNotificationHandler";

const EVENT_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.CUSTOMER_CREATED]: "customerWelcome",
  [EVENT_NAMES.CUSTOMER_ACTIVATED]: "customerActivated",
  [EVENT_NAMES.PACKAGE_CHANGED]: "packageChanged",
};

// CUSTOMER_SUSPENDED mewakili tiga status berbeda; pesannya per status tujuan.
const SUSPENDED_TEMPLATE_BY_STATUS: Record<string, BillingTemplateKey> = {
  NONAKTIF: "customerDeactivated",
  MAINTENANCE: "customerMaintenance",
  DISMANTLE: "customerDismantled",
};

type EventPayload = EventJobData["payload"];

/**
 * Isolir hanya disebut "karena tunggakan" bila penerbit event menemukan
 * tagihan lewat jatuh tempo (`arrearsInvoiceNumber`); selain itu, misalnya
 * admin mengisolir pelanggan tanpa tagihan, pesannya netral.
 */
function resolveTemplateKey(
  eventName: string,
  payload: EventPayload,
): BillingTemplateKey | undefined {
  if (eventName === EVENT_NAMES.CUSTOMER_ISOLATED) {
    return hasArrears(payload) ? "customerIsolated" : "customerIsolatedByAdmin";
  }
  if (eventName === EVENT_NAMES.CUSTOMER_SUSPENDED) {
    return typeof payload.newStatus === "string"
      ? SUSPENDED_TEMPLATE_BY_STATUS[payload.newStatus]
      : undefined;
  }
  return EVENT_TEMPLATE_MAP[eventName];
}

function hasArrears(payload: EventPayload): boolean {
  return typeof payload.arrearsInvoiceNumber === "string";
}

function buildTemplateParams(payload: EventPayload): BillingTemplateParams {
  return {
    customerName:
      typeof payload.customerName === "string" ? payload.customerName : "",
    username:
      typeof payload.username === "string" ? payload.username : undefined,
    packageName:
      typeof payload.packageName === "string" ? payload.packageName : undefined,
    ...(hasArrears(payload)
      ? {
          invoiceNumber: payload.arrearsInvoiceNumber as string,
          amountDue: Number(payload.arrearsAmount ?? 0),
        }
      : {}),
  };
}

/**
 * Handler yang subscribe ke event customer lifecycle dan dispatch
 * notifikasi multi-channel (WA/Email/Push/In-App) via NotificationDispatcher.
 * Independent dari handler sync MikroTik — kedua handler berjalan paralel untuk event yang sama.
 */
export async function handleCustomerNotification(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const templateKey = resolveTemplateKey(eventName, payload);
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

  await new NotificationDispatcher().dispatch({
    pelangganId,
    templateKey,
    params: buildTemplateParams(payload),
    sourceType: "CUSTOMER_LIFECYCLE",
    sourceId: pelangganId,
    // Idempotency: BullMQ retry pakai job.id sama, jadi dedupeKey stabil
    // antar attempt — cegah double-send saat job di-retry.
    dedupeKey: job.id ? `${eventName}:${job.id}` : undefined,
  });
}
