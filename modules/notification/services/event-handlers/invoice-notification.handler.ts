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

const optionalString = (value: unknown) =>
  typeof value === "string" ? value : undefined;

const optionalNumber = (value: unknown) =>
  typeof value === "number" ? value : undefined;

/** Checkout transfer bisa mencakup beberapa tagihan. */
const joinInvoiceNumbers = (value: unknown) =>
  Array.isArray(value) && value.length > 0
    ? value.filter((item) => typeof item === "string").join(", ")
    : undefined;

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
  [EVENT_NAMES.PAYMENT_REDIRECTED]: "paymentRedirected",
  [EVENT_NAMES.PAYMENT_REJECTED]: "paymentRejected",
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

/**
 * Template untuk event ini; tagihan pengganti memakai template penggantian,
 * dan tagihan yang lunas seluruhnya dengan saldo kredit memakai template
 * "dibayar dengan saldo", bukan "Pembayaran Rp 0 berhasil".
 */
function resolveTemplateKey(
  eventName: string,
  payload: Record<string, unknown>,
): BillingTemplateKey | undefined {
  if (
    eventName === EVENT_NAMES.INVOICE_CREATED &&
    isReplacementReason(payload.replacementReason)
  ) {
    return REPLACEMENT_TEMPLATE_MAP[payload.replacementReason];
  }
  if (eventName === EVENT_NAMES.INVOICE_PAID && isPaidWithSaldoOnly(payload)) {
    return "invoicePaidWithSaldo";
  }
  return EVENT_TEMPLATE_MAP[eventName];
}

const isPaidWithSaldoOnly = (payload: Record<string, unknown>) =>
  payload.amountPaid === 0 && Number(payload.saldoUsed ?? 0) > 0;

/**
 * Tagihan biasa yang seluruhnya tertutup saldo kredit lunas saat terbit;
 * pemberitahuan "dibayar dengan saldo" dari INVOICE_PAID-nya sudah cukup.
 */
const isCoveredBySaldoAtCreation = (
  templateKey: BillingTemplateKey,
  payload: Record<string, unknown>,
) =>
  templateKey === "invoiceCreated" &&
  Number(payload.amount ?? 0) === 0 &&
  Number(payload.creditApplied ?? 0) > 0;

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
  const templateKey = resolveTemplateKey(eventName, payload);
  if (!templateKey) {
    logger.debug(
      `[InvoiceNotificationHandler] Skip unrecognized event ${eventName}`,
    );
    return;
  }
  if (isCoveredBySaldoAtCreation(templateKey, payload)) {
    logger.debug(
      `[InvoiceNotificationHandler] Skip invoiceCreated untuk tagihan yang lunas dengan saldo kredit`,
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
    optionalString(payload.invoiceNumber) ??
    optionalString(payload.cancelledInvoiceNumber) ??
    joinInvoiceNumbers(payload.invoiceNumbers);
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
      replacementInvoiceNumber: optionalString(
        payload.replacementInvoiceNumber,
      ),
      appliedAmount: optionalNumber(payload.appliedAmount),
      creditedAmount: optionalNumber(payload.creditedAmount),
      rejectionReason: optionalString(payload.reason),
      creditApplied: optionalNumber(payload.creditApplied),
      grossAmount: optionalNumber(payload.grossAmount),
      amountPaid: optionalNumber(payload.amountPaid),
      couponDiscount: optionalNumber(payload.couponDiscount),
      saldoUsed: optionalNumber(payload.saldoUsed),
    },
    sourceType: "BILLING",
    sourceId: invoiceId,
    channels: EVENT_CHANNELS[eventName],
    // Idempotency: cegah double-send saat BullMQ retry job sama.
    dedupeKey: job.id ? `${eventName}:${job.id}` : undefined,
  });
}
