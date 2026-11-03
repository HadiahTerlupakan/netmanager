import type { Pelanggan } from "@prisma/client";
import {
  eventBus,
  EVENT_NAMES,
  JOB_PRIORITIES,
  type EventPayloadMap,
  type InvoicePaidBreakdown,
  type PaymentRedirectedPayload,
  type PaymentRejectedPayload,
  type PaymentReviewRequiredPayload,
} from "@/lib/event-bus";

export class BillingEventDispatcher {
  /**
   * Hook ini dipanggil setelah Pelanggan baru dibuat di database utama.
   * Mem-publish event CUSTOMER_CREATED agar sistem terkait (billing, notifikasi, dll)
   * dapat memproses secara async via BullMQ.
   */
  static async onCustomerCreated(customer: Pelanggan) {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_CREATED, {
      customerId: customer.id,
      customerName: customer.nama,
      tenantId: customer.tenantId ?? undefined,
    });
  }

  /**
   * Hook ini dipanggil setelah status Invoice berubah menjadi PAID.
   * Mem-publish event INVOICE_PAID yang akan:
   * 1. Mengaktifkan status pelanggan di DB Utama (via BullMQ worker)
   * 2. Mengirim notifikasi ke user terkait
   * 3. Mengupdate WebSocket real-time
   *
   * Menggunakan Outbox Pattern: event disimpan di DB dalam transaksi yang sama
   * dengan update invoice, sehingga dijamin ter-delivery meskipun BullMQ down.
   */
  static async onInvoicePaid(
    invoiceId: string,
    pelangganId: string,
    amount?: number,
    breakdown?: InvoicePaidBreakdown,
    tenantId?: string | null,
  ) {
    await eventBus.publish(
      EVENT_NAMES.INVOICE_PAID,
      {
        invoiceId,
        pelangganId,
        amount: amount ?? 0,
        paidAt: new Date().toISOString(),
        ...breakdown,
        // Tanpa tenantId worker menjalankan handler di system context, dan
        // handler yang menyaring per tenant (komisi reseller) tidak menemukan
        // apa pun.
        ...(tenantId ? { tenantId } : {}),
      },
      {
        // Critical event — use highest priority
        priority: JOB_PRIORITIES.CRITICAL,
      },
    );
  }

  /** Sebagian tagihan dibayar; dipakai untuk membukukan uang yang masuk. */
  static async onInvoicePartiallyPaid(
    invoiceId: string,
    pelangganId: string,
    amount: number,
    tenantId?: string | null,
  ) {
    await eventBus.publish(EVENT_NAMES.INVOICE_PARTIALLY_PAID, {
      invoiceId,
      pelangganId,
      amount,
      paidAt: new Date().toISOString(),
      ...(tenantId ? { tenantId } : {}),
    });
  }

  /**
   * Tagihan yang sudah dibayar dibatalkan admin; konsumen membatalkan efek
   * turunan pembayarannya (mis. komisi reseller yang belum disettle).
   */
  static async onInvoiceVoided(
    data: EventPayloadMap[typeof EVENT_NAMES.INVOICE_VOIDED],
  ) {
    await eventBus.publish(EVENT_NAMES.INVOICE_VOIDED, data, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }

  /**
   * Tagihan PAID tidak lagi lunas setelah dihitung ulang (payment di-refund
   * atau dihapus); konsumen menahan efek turunan pelunasan yang belum final.
   */
  static async onInvoicePaymentReverted(
    data: EventPayloadMap[typeof EVENT_NAMES.INVOICE_PAYMENT_REVERTED],
  ) {
    await eventBus.publish(EVENT_NAMES.INVOICE_PAYMENT_REVERTED, data, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }

  /**
   * Checkout gateway berakhir tanpa dibayar (kedaluwarsa); pelanggan diberi
   * tahu agar membayar lagi.
   */
  static async onPaymentFailed(data: {
    invoiceId: string;
    pelangganId: string;
    amount: number;
    dueDate: string;
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_FAILED, data);
  }

  /**
   * Pembayaran yang melebihi tagihan (VA lama yang tetap dibayar setelah
   * ganti metode) sudah dikreditkan ke saldo; pelanggan diberi tahu.
   */
  static async onPaymentOverpaid(data: {
    invoiceId: string;
    pelangganId: string;
    amount: number;
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_OVERPAID, data);
  }

  /**
   * Uang untuk tagihan yang sudah dibatalkan sudah dialihkan ke tagihan
   * penggantinya dan/atau saldo kredit; pelanggan diberi tahu ke mana.
   */
  static async onPaymentRedirected(data: PaymentRedirectedPayload) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_REDIRECTED, data);
  }

  /**
   * Admin menolak bukti transfer manual; pelanggan diberi tahu beserta
   * alasannya agar bisa mengunggah ulang atau memilih metode lain.
   */
  static async onPaymentRejected(data: PaymentRejectedPayload) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_REJECTED, data);
  }

  /**
   * Gateway melaporkan pembayaran yang tidak cocok dengan catatan checkout
   * (nominal atau nomor transaksi); staf keuangan perlu memeriksanya karena
   * tagihannya tidak dilunasi otomatis.
   */
  static async onPaymentReviewRequired(data: PaymentReviewRequiredPayload) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_REVIEW_REQUIRED, data);
  }

  /**
   * Diemit oleh scheduler ketika invoice overdue + grace period habis dan pelanggan perlu di-isolir.
   */
  static async onAutoIsolateRequested(data: {
    invoiceId: string;
    pelangganId: string;
    invoiceNumber: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
      {
        invoiceId: data.invoiceId,
        pelangganId: data.pelangganId,
        invoiceNumber: data.invoiceNumber,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }

  /**
   * Diemit saat scheduler reminder detect invoice mendekati / melewati jatuh tempo.
   * Handler notifikasi akan dispatch ke multi-channel (WA/Email/Push/In-App).
   */
  static async onInvoiceReminderDue(data: {
    invoiceId: string;
    pelangganId: string;
    invoiceNumber: string;
    amountDue: number;
    dueDate: string;
    reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.INVOICE_REMINDER_DUE,
      {
        invoiceId: data.invoiceId,
        pelangganId: data.pelangganId,
        invoiceNumber: data.invoiceNumber,
        amountDue: data.amountDue,
        dueDate: data.dueDate,
        reminderType: data.reminderType,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.NORMAL,
      },
    );
  }

  /**
   * Diemit saat invoice transisi ke status OVERDUE (past due date, belum bayar).
   * Berbeda dengan INVOICE_REMINDER_DUE yang periodic — ini one-shot saat transisi.
   */
  static async onInvoiceOverdue(data: {
    invoiceId: string;
    pelangganId: string;
    amount: number;
    dueDate: string;
    tenantId?: string;
  }) {
    await eventBus.publish(
      EVENT_NAMES.INVOICE_OVERDUE,
      {
        invoiceId: data.invoiceId,
        pelangganId: data.pelangganId,
        amount: data.amount,
        dueDate: data.dueDate,
        tenantId: data.tenantId,
      },
      {
        priority: JOB_PRIORITIES.HIGH,
      },
    );
  }

  /**
   * Diemit saat paket pelanggan berubah (upgrade/downgrade).
   * Handler akan disconnect active PPP session + resync MikroTik + apply prorate.
   */
  static async onPackageChanged(data: {
    customerId: string;
    customerName: string;
    oldPackageId: string;
    newPackageId: string;
    oldProfileName: string;
    newProfileName: string;
    oldPackagePrice: number;
    newPackagePrice: number;
    applyTime: "IMMEDIATE" | "NEXT_CYCLE";
    tenantId?: string;
  }) {
    await eventBus.publish(EVENT_NAMES.PACKAGE_CHANGED, data, {
      priority: JOB_PRIORITIES.HIGH,
    });
  }
}
