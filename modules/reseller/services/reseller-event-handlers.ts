import type { Job } from "bullmq";
import * as z from "zod";
import type { EventJobData } from "@/lib/event-bus/queues";
import { logger } from "@/lib/logger";
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

/**
 * Batalkan komisi reseller yang belum disettle saat invoice tidak lagi lunas:
 * INVOICE_VOIDED (di-void) dan INVOICE_PAYMENT_REVERTED (payment di-refund atau
 * dihapus). Idempoten: replay hanya menemukan baris yang sudah dihapus.
 */
export async function handleInvoiceUnpaidResellerCommission(
  job: Job<EventJobData>,
): Promise<void> {
  const parsed = invoiceUnpaidPayloadSchema.safeParse(job.data.payload);
  if (!parsed.success) {
    throw new Error("Payload invoice unpaid tidak valid untuk komisi reseller");
  }

  const cancelled =
    await getResellerCommissionService().cancelAccruedForUnpaidInvoice({
      tenantId: parsed.data.tenantId ?? null,
      invoiceId: parsed.data.invoiceId,
    });
  if (cancelled > 0) {
    logger.info(
      `[ResellerCommission] ${cancelled} komisi ACCRUED dibatalkan untuk invoice ${parsed.data.invoiceId} yang tidak lagi lunas (${job.data.eventName})`,
    );
  }
}
