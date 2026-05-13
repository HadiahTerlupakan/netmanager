import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { EVENT_NAMES, requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import {
  NotificationDispatcher,
  type BillingTemplateKey,
} from "@/modules/notification";

const SOURCE = "InvoiceNotificationHandler";

const EVENT_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.INVOICE_CREATED]: "invoiceCreated",
  [EVENT_NAMES.INVOICE_PAID]: "invoicePaid",
  [EVENT_NAMES.INVOICE_REMINDER_DUE]: "invoiceReminder",
  [EVENT_NAMES.INVOICE_OVERDUE]: "invoiceReminder",
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
  const templateKey = EVENT_TEMPLATE_MAP[eventName];
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
    dueDate =
      dueDate ??
      (invoice ? invoice.dueDate.toLocaleDateString("id-ID") : undefined);
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
    },
    sourceType: "BILLING",
    sourceId: invoiceId,
  });
}
