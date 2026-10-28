import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { postInvoiceReceipts } from "../journal/invoice-journals";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "InvoicePaidAccountingHandler";

/** Dipakai untuk pelunasan dan pembayaran sebagian. */
export async function handleInvoicePaidAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const invoiceId = requirePayloadString(
    job.data.payload.invoiceId,
    "invoiceId",
    SOURCE,
  );

  try {
    const count = await postInvoiceReceipts(invoiceId);
    logger.info(
      `[${SOURCE}] ${count} penerimaan dibukukan untuk invoice ${invoiceId}`,
    );
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(`[${SOURCE}] COA belum di-seed, skipping: ${error.message}`);
      return;
    }
    throw error;
  }
}
