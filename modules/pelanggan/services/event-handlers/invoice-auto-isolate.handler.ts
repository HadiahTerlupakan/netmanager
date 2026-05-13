import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { AutomaticIsolationExecutionService } from "@/modules/finance";

const SOURCE = "InvoiceAutoIsolateHandler";

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

  logger.info(
    `[InvoiceAutoIsolateHandler] Executing auto-isolate for invoice ${invoiceId} / pelanggan ${pelangganId}`,
  );

  const executor = new AutomaticIsolationExecutionService();
  await executor.execute({ invoiceId, pelangganId });
}
