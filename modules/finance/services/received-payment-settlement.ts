import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { InvoiceStatus } from "../types/invoice.enums";
import {
  redirectPaymentsOfCancelledInvoice,
  type RedirectablePayment,
} from "./cancelled-invoice-payments";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";
import { creditOverpaidPayments } from "./overpayment-credit";

/** Payment yang uangnya sudah diterima (gateway PAID, transfer disetujui). */
export type ReceivedPayment = RedirectablePayment & {
  invoiceId: string | null;
};

/**
 * Satu langkah pelunasan untuk payment yang uangnya sudah diterima. Webhook
 * gateway, cek status gateway, penyapu checkout, dan persetujuan transfer
 * manual memakai jalur yang sama:
 *
 * 1. Tagihan hidup dihitung ulang; INVOICE_PAID terkirim sekali saat lunas.
 * 2. Tagihan yang sudah dibatalkan tidak dihidupkan lagi; uangnya dialihkan
 *    ke tagihan penggantinya dan sisanya ke saldo kredit.
 * 3. Kelebihan di atas tagihan menjadi saldo kredit, dengan pemberitahuan.
 *
 * Idempoten: pemanggilan ulang untuk payment yang sama (retry webhook, proses
 * yang mati di tengah jalan) hanya menyelesaikan langkah yang belum terjadi.
 */
export async function settleReceivedPayments(payments: ReceivedPayment[]) {
  for (const [invoiceId, group] of groupByInvoice(payments)) {
    await inPaymentTenant(group[0].tenantId, () =>
      settleInvoicePayments(invoiceId, group),
    );
  }
  await creditOverpaidPayments(payments);
}

async function settleInvoicePayments(
  invoiceId: string,
  payments: ReceivedPayment[],
) {
  const result = await new InvoicePaymentStateService().recompute(invoiceId);
  if (result?.invoice.status === InvoiceStatus.CANCELLED) {
    await redirectPaymentsOfCancelledInvoice(invoiceId, payments);
  }
}

function groupByInvoice(payments: ReceivedPayment[]) {
  const groups = new Map<string, ReceivedPayment[]>();
  for (const payment of payments) {
    if (!payment.invoiceId) continue;
    groups.set(payment.invoiceId, [
      ...(groups.get(payment.invoiceId) ?? []),
      payment,
    ]);
  }
  return groups;
}

/**
 * Webhook dan cron datang tanpa konteks tenant, sedangkan klien billing
 * menolak query tanpa tenant; konteksnya diambil dari payment.
 */
function inPaymentTenant<T>(tenantId: string | null, task: () => Promise<T>) {
  return tenantId
    ? runWithRequestTenantContext({ tenantId, isSuperAdmin: false }, task)
    : runAsSystemContext("pelunasan: payment tanpa tenant", task);
}
