import type { Job } from "bullmq";
import { prismaBilling } from "@/lib/prisma-billing";
import {
  runAsSystemContext,
  runWithRequestTenantContext,
} from "@/lib/tenant-context";
import type { EventJobData } from "@/lib/event-bus/queues";
import { handleInvoiceCreatedAccounting } from "@/modules/accounting/services/event-handlers/invoice-created-accounting.handler";
import { handleInvoicePaidAccounting } from "@/modules/accounting/services/event-handlers/invoice-paid-accounting.handler";
import { logger } from "@/lib/logger";

/**
 * Bentuk ulang jurnal invoice yang gagal diposting selama trigger
 * check_journal_balance membaca kolom yang tidak ada.
 *
 * Memanggil handler akuntansi langsung, bukan me-retry job antrean: retry
 * menjalankan ulang semua handler event itu, termasuk notifikasi ke
 * pelanggan. Idempoten: postAuto melewati jurnal yang sudah ada.
 *
 * Pakai: tsx scripts/backfill-invoice-journals.ts [--dry-run]
 */

const dryRun = process.argv.includes("--dry-run");

function fakeJob(eventName: string, invoiceId: string) {
  return {
    name: eventName,
    data: { eventName, payload: { invoiceId } },
  } as unknown as Job<EventJobData>;
}

async function main() {
  // Invoice batal tidak pernah membentuk piutang yang masih berlaku, dan
  // tidak ada handler pembatalan yang akan membalik jurnalnya.
  const invoices = await runAsSystemContext(
    "backfill-invoice-journals",
    async () =>
      await prismaBilling.invoice.findMany({
        where: { tenantId: { not: null }, status: { not: "CANCELLED" } },
        select: { id: true, tenantId: true, status: true, invoiceNumber: true },
        orderBy: { createdAt: "asc" },
      }),
  );

  let failed = 0;
  for (const invoice of invoices) {
    logger.info(`[backfill] ${invoice.invoiceNumber} ${invoice.status}`);
    if (dryRun) continue;

    try {
      await runWithRequestTenantContext(
        { tenantId: invoice.tenantId as string, isSuperAdmin: false },
        async () => {
          await handleInvoiceCreatedAccounting(
            fakeJob("event.billing.invoice.created", invoice.id),
          );
          if (invoice.status === "PAID") {
            await handleInvoicePaidAccounting(
              fakeJob("event.billing.invoice.paid", invoice.id),
            );
          }
        },
      );
    } catch (error) {
      failed++;
      logger.error(`[backfill] ${invoice.invoiceNumber} gagal:`, error);
    }
  }

  logger.info(
    `[backfill] selesai: ${invoices.length} invoice, ${failed} gagal${dryRun ? " (dry run)" : ""}`,
  );
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  logger.error("[backfill] berhenti:", error);
  process.exit(1);
});
