import type { Job } from "bullmq";
import * as z from "zod";
import type { EventJobData } from "@/lib/event-bus/queues";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import { logger } from "@/lib/logger";
import { getResellerCommissionReversalService } from "./ResellerCommissionReversalService";
import { getResellerCommissionService } from "./ResellerCommissionService";

const optionalTenantIdSchema = z.string().min(1).optional();

const invoicePaidPayloadSchema = z.object({
  tenantId: optionalTenantIdSchema,
  invoiceId: z.string().min(1),
  pelangganId: z.string().min(1),
  amount: z.number(),
  paidAt: z.string().min(1),
});

const invoiceUnpaidPayloadSchema = z.object({
  tenantId: optionalTenantIdSchema,
  invoiceId: z.string().min(1),
});

/** Akru komisi reseller saat invoice pelanggan reseller lunas. */
export async function handleInvoicePaidResellerCommission(
  job: Job<EventJobData>,
): Promise<void> {
  const parsed = invoicePaidPayloadSchema.safeParse(job.data.payload);
  if (!parsed.success) {
    throw new Error("Payload invoice paid tidak valid untuk komisi reseller");
  }

  // tenantId boleh tidak ada (event lama di outbox): service me-resolve
  // tenant dari pelanggan.
  await getResellerCommissionService().accrueFromPaidInvoice({
    tenantId: parsed.data.tenantId ?? null,
    invoiceId: parsed.data.invoiceId,
    pelangganId: parsed.data.pelangganId,
    amount: parsed.data.amount,
    paidAt: new Date(parsed.data.paidAt),
  });
}

const CLAWBACK_REASON_VOIDED = "Invoice di-void setelah komisi dibayar";
const CLAWBACK_REASON_PAYMENT_REVERTED =
  "Pelunasan invoice ditarik setelah komisi dibayar";

function clawbackReasonOf(eventName: string): string {
  return eventName === EVENT_NAMES.INVOICE_VOIDED
    ? CLAWBACK_REASON_VOIDED
    : CLAWBACK_REASON_PAYMENT_REVERTED;
}

/**
 * Balik komisi reseller saat invoice tidak lagi lunas: INVOICE_VOIDED
 * (di-void) dan INVOICE_PAYMENT_REVERTED (payment di-refund atau dihapus).
 * Komisi yang belum dibayar dibatalkan; yang sudah dibayar ditagih balik
 * lewat koreksi pada settlement berikutnya. Idempoten.
 */
export async function handleInvoiceUnpaidResellerCommission(
  job: Job<EventJobData>,
): Promise<void> {
  const parsed = invoiceUnpaidPayloadSchema.safeParse(job.data.payload);
  if (!parsed.success) {
    throw new Error("Payload invoice unpaid tidak valid untuk komisi reseller");
  }

  const summary =
    await getResellerCommissionReversalService().reverseForUnpaidInvoice({
      tenantId: parsed.data.tenantId ?? null,
      invoiceId: parsed.data.invoiceId,
      reason: clawbackReasonOf(job.data.eventName),
    });
  if (summary.cancelledCount > 0 || summary.clawbackCount > 0) {
    logger.info(
      `[ResellerCommission] Invoice ${parsed.data.invoiceId} tidak lagi lunas (${job.data.eventName}): ${summary.cancelledCount} komisi dibatalkan, ${summary.clawbackCount} koreksi komisi dibayar`,
    );
  }
}
