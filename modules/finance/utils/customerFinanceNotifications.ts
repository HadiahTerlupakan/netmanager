import { createNotification } from "@/modules/notification";

interface CustomerFinanceNotificationInput {
  userId: string | null | undefined;
  title: string;
  message: string;
  link: string;
  sourceType: string;
  sourceId: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

/**
 * @deprecated Sejak Phase 6 (Event-Driven Refactor). Notifikasi pelanggan sekarang
 * dipicu via event bus (CUSTOMER_ISOLATED, INVOICE_PAID, INVOICE_REMINDER_DUE, dll)
 * dan di-dispatch ke multi-channel (WA/Email/Push/In-App) oleh
 * `NotificationDispatcher`.
 *
 * JANGAN tambah caller baru. Gunakan event emission via `BillingEventDispatcher`
 * atau `CustomerEventDispatcher`.
 */
export async function notifyCustomerFinanceNotification(
  input: CustomerFinanceNotificationInput,
): Promise<boolean> {
  if (!input.userId) {
    return false;
  }

  await createNotification({
    type: "SYSTEM",
    userId: input.userId,
    title: input.title,
    message: input.message,
    link: input.link,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    priority: input.priority,
  });

  return true;
}
