import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { AutomaticBillingService } from "../AutomaticBillingService";

const SOURCE = "InvoicePaidBillingHandler";

/**
 * Handler INVOICE_PAID dari sisi finance — update jatuh tempo + cancel
 * scheduled overdue/isolate jobs. Pelanggan activation guard ada di handler
 * terpisah di module pelanggan supaya boundary modul tetap bersih.
 *
 * Error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handleInvoicePaidBilling(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    SOURCE,
  );

  logger.info(`[${SOURCE}] Update billing state for invoice ${invoiceId}`);

  await AutomaticBillingService.handleInvoicePaid(invoiceId);
}
