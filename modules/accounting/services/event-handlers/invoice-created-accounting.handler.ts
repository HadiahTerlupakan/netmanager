import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { postInvoiceAccrual } from "../journal/invoice-journals";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "InvoiceCreatedAccountingHandler";

export async function handleInvoiceCreatedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const invoiceId = requirePayloadString(
    job.data.payload.invoiceId,
    "invoiceId",
    SOURCE,
  );

  try {
    if (await postInvoiceAccrual(invoiceId)) {
      logger.info(`[${SOURCE}] Journal posted for invoice ${invoiceId}`);
    }
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(`[${SOURCE}] COA belum di-seed, skipping: ${error.message}`);
      return;
    }
    throw error;
  }
}
