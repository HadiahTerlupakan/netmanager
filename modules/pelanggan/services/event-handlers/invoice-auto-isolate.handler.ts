import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import type { EventJobData } from "@/lib/event-bus/queues";
import { AutomaticIsolationExecutionService } from "@/modules/finance";

/**
 * Helper validasi payload — throw error untuk field yang tidak valid
 * supaya BullMQ retry dengan backoff.
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(
      `[InvoiceAutoIsolateHandler] Payload field "${field}" harus string non-kosong, dapat ${typeof value}`,
    );
  }
  return value;
}

/**
 * Handler untuk event INVOICE_AUTO_ISOLATE_REQUESTED.
 * Diemit oleh scheduler finance saat invoice overdue + grace period habis,
 * dan pelanggan auto-isolir aktif. Handler menjalankan isolir real.
 *
 * Error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handleInvoiceAutoIsolate(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requireString(payload.invoiceId, "invoiceId");
  const pelangganId = requireString(payload.pelangganId, "pelangganId");

  logger.info(
    `[InvoiceAutoIsolateHandler] Executing auto-isolate for invoice ${invoiceId} / pelanggan ${pelangganId}`,
  );

  const executor = new AutomaticIsolationExecutionService();
  await executor.execute({ invoiceId, pelangganId });
}
