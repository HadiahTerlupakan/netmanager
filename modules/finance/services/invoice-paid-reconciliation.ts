import { EVENT_NAMES, findRecordedOutboxKeys } from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import { InvoiceRepository } from "../repositories/InvoiceRepository";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";

/**
 * Lebih pendek dari retensi outbox: baris COMPLETED dihapus setelah 7 hari
 * (`cleanupOldEvents`), dan tanpa barisnya event dianggap hilang.
 */
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
/** Beri waktu jalur normal menulis outbox sebelum dianggap hilang. */
const SETTLE_DELAY_MS = 15 * 60 * 1000;
const BATCH_SIZE = 500;

/**
 * Kirim ulang INVOICE_PAID yang tidak pernah tercatat di outbox.
 *
 * Peralihan invoice ke PAID di-commit di database billing sebelum event-nya
 * ditulis ke outbox di database utama; proses yang mati di antaranya
 * meninggalkan invoice lunas tanpa perpanjangan jatuh tempo, aktivasi
 * pelanggan isolir, jurnal penerimaan, atau notifikasi. Pass ini mencari
 * invoice yang lunas dalam tiga hari terakhir (minus jeda 15 menit) tanpa
 * baris outbox INVOICE_PAID dan mengirim ulang event-nya.
 *
 * Bila outbox gagal ditulis tetapi job antrean tetap jalan, handler-nya
 * berjalan dua kali; semuanya idempoten kecuali notifikasi pelanggan yang
 * bisa terkirim dua kali. Itu lebih murah daripada pelanggan lunas yang tetap
 * diisolir.
 *
 * @returns jumlah invoice yang event-nya dikirim ulang.
 */
export async function replayMissingInvoicePaidEvents(
  now = new Date(),
): Promise<number> {
  const from = new Date(now.getTime() - LOOKBACK_MS);
  const to = new Date(now.getTime() - SETTLE_DELAY_MS);
  const paid = await new InvoiceRepository().findPaidBetween(
    from,
    to,
    BATCH_SIZE,
  );
  if (paid.length === 0) return 0;

  const recorded = await findRecordedOutboxKeys({
    eventName: EVENT_NAMES.INVOICE_PAID,
    payloadKey: "invoiceId",
    values: paid.map((invoice) => invoice.id),
    since: from,
  });
  const missing = paid.filter((invoice) => !recorded.has(invoice.id));
  for (const invoice of missing) {
    logger.error(
      `[InvoicePaidReconciliation] INVOICE_PAID invoice ${invoice.id} tidak pernah tercatat di outbox; dikirim ulang`,
    );
    await inInvoiceTenant(invoice.tenantId, () =>
      new InvoicePaymentStateService().replayInvoicePaid(invoice.id),
    );
  }
  return missing.length;
}

function inInvoiceTenant<T>(tenantId: string | null, task: () => Promise<T>) {
  return tenantId
    ? runWithRequestTenantContext({ tenantId, isSuperAdmin: false }, task)
    : runAsSystemContext("rekonsiliasi INVOICE_PAID tanpa tenant", task);
}
