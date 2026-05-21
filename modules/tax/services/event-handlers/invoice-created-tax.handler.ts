import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prismaBilling } from "@/lib/prisma-billing";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import { getPpnService } from "../../index";

const SOURCE = "InvoiceCreatedTaxHandler";

/**
 * Handles INVOICE_CREATED event to record PPN Keluaran.
 * Gracefully skips if tenant is not PKP or COA not seeded.
 */
export async function handleInvoiceCreatedTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = requirePayloadString(
    payload.invoiceId,
    "invoiceId",
    SOURCE,
  );

  const invoice = await prismaBilling.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true, totalAmount: true, createdAt: true },
  });
  if (!invoice || !invoice.tenantId) {
    logger.warn(
      `[${SOURCE}] Invoice ${invoiceId} not found or no tenantId, skipping`,
    );
    return;
  }

  const tenantId = invoice.tenantId;
  const invoiceAmount = Number(payload.amount ?? invoice.totalAmount);
  const invoiceDate = new Date(
    (payload.createdAt as string) ?? invoice.createdAt.toISOString(),
  );

  try {
    const ppnService = getPpnService();
    await ppnService.recordPpnKeluaran({
      tenantId,
      invoiceId,
      invoiceAmount,
      invoiceDate,
    });
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}, skipping: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
