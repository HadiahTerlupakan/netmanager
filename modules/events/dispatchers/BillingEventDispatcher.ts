import type { Pelanggan } from "@prisma/client";
import { eventBus, EVENT_NAMES } from "@/lib/event-bus";

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
  ) {
    await eventBus.publish(
      EVENT_NAMES.INVOICE_PAID,
      {
        invoiceId,
        pelangganId,
        amount: amount ?? 0,
        paidAt: new Date().toISOString(),
      },
      {
        // Critical event — use highest priority
        priority: 1,
      },
    );
  }

  /**
   * Hook untuk event pembayaran gagal.
   */
  static async onPaymentFailed(invoiceId: string, pelangganId: string) {
    await eventBus.publish(EVENT_NAMES.PAYMENT_FAILED, {
      invoiceId,
      pelangganId,
      amount: 0,
      dueDate: new Date().toISOString(),
    });
  }

  /** Diemit oleh scheduler ketika invoice overdue + grace period habis dan pelanggan perlu di-isolir. */
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
        priority: 2,
      },
    );
  }
}
