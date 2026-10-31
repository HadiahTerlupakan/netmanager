import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import {
  EVENT_NAMES,
  requirePayloadString,
  type InvoiceReplacementReason,
} from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import {
  NotificationDispatcher,
  type BillingTemplateKey,
  type NotificationChannel,
} from "@/modules/notification";

const SOURCE = "InvoiceNotificationHandler";

const MONTH_NAMES_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

function formatDateId(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES_ID[date.getMonth()]} ${date.getFullYear()}`;
}

const EVENT_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.INVOICE_CREATED]: "invoiceCreated",
  [EVENT_NAMES.INVOICE_PAID]: "invoicePaid",
  [EVENT_NAMES.INVOICE_REMINDER_DUE]: "invoiceReminder",
  [EVENT_NAMES.INVOICE_OVERDUE]: "invoiceReminder",
  [EVENT_NAMES.PAYMENT_FAILED]: "paymentExpired",
  [EVENT_NAMES.PAYMENT_OVERPAID]: "overpaymentCredited",
};

// Tagihan pengganti tetap terbit lewat INVOICE_CREATED (jurnal dan PPN-nya
// sama dengan tagihan biasa), tetapi pelanggan perlu tahu tagihan lamanya batal.
const REPLACEMENT_TEMPLATE_MAP: Record<
  InvoiceReplacementReason,
  BillingTemplateKey
> = {
  PACKAGE_CHANGED: "invoiceRepriced",
  PACKAGE_CHANGE_CANCELLED: "invoiceRepriceReverted",
};

function isReplacementReason(
  value: unknown,
): value is InvoiceReplacementReason {
  return (
    typeof value === "string" && Object.hasOwn(REPLACEMENT_TEMPLATE_MAP, value)
  );
}

/** Template untuk event ini; tagihan pengganti memakai template penggantian. */
function resolveTemplateKey(
  eventName: string,
  replacementReason: unknown,
): BillingTemplateKey | undefined {
  if (
    eventName === EVENT_NAMES.INVOICE_CREATED &&
    isReplacementReason(replacementReason)
  ) {
    return REPLACEMENT_TEMPLATE_MAP[replacementReason];
  }
  return EVENT_TEMPLATE_MAP[eventName];
}

// Checkout yang ditinggal cukup diingatkan di portal dan aplikasi; WhatsApp
// dan email disimpan untuk tagihan itu sendiri.
const EVENT_CHANNELS: Partial<Record<string, NotificationChannel[]>> = {
  [EVENT_NAMES.PAYMENT_FAILED]: ["inApp", "push"],
};

/**
 * Handler yang subscribe ke event invoice lifecycle dan dispatch
 * notifikasi multi-channel via NotificationDispatcher.
 * Fallback query DB untuk invoiceNumber/dueDate jika tidak ada di payload.
 */
export async function handleInvoiceNotification(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const templateKey = resolveTemplateKey(eventName, payload.replacementReason);
  if (!templateKey) {
    logger.debug(
      `[InvoiceNotificationHandler] Skip unrecognized event ${eventName}`,
    );
    return;
  }

  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    SOURCE,
  );
  const pelangganId = requirePayloadString(
    payload.pelangganId,
    "pelangganId",
    SOURCE,
  );
  const amountDue = Number(payload.amountDue ?? payload.amount ?? 0);
  const providedInvoiceNumber =
    typeof payload.invoiceNumber === "string"
      ? payload.invoiceNumber
      : undefined;
  const providedDueDate =
    typeof payload.dueDate === "string" ? payload.dueDate : undefined;
  const replacesInvoiceNumber =
    typeof payload.replacesInvoiceNumber === "string"
      ? payload.replacesInvoiceNumber
      : undefined;
  const reminderType =
    typeof payload.reminderType === "string"
      ? (payload.reminderType as "UPCOMING" | "DUE_TODAY" | "OVERDUE")
      : undefined;

  let invoiceNumber = providedInvoiceNumber;
  let dueDate = providedDueDate;
  if (!invoiceNumber || !dueDate) {
    const invoice = await prismaBilling.invoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, dueDate: true },
    });
    invoiceNumber = invoiceNumber ?? invoice?.invoiceNumber;
    dueDate = dueDate ?? (invoice ? formatDateId(invoice.dueDate) : undefined);
  }

  // Default reminderType untuk INVOICE_OVERDUE kalau belum di-set
  const effectiveReminderType =
    reminderType ??
    (eventName === EVENT_NAMES.INVOICE_OVERDUE ? "OVERDUE" : "UPCOMING");

  await new NotificationDispatcher().dispatch({
    pelangganId,
    templateKey,
    params: {
      customerName: "",
      invoiceNumber,
      amountDue,
      dueDate,
      reminderType: effectiveReminderType,
      replacesInvoiceNumber,
    },
    sourceType: "BILLING",
    sourceId: invoiceId,
    channels: EVENT_CHANNELS[eventName],
    // Idempotency: cegah double-send saat BullMQ retry job sama.
    dedupeKey: job.id ? `${eventName}:${job.id}` : undefined,
  });
}
