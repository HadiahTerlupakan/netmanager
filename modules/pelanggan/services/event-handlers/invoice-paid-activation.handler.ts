import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { FinanceRepositoryFacade } from "@/modules/finance";
import { getPelangganService } from "../PelangganService";
import { PelangganBillingBridgeService } from "../PelangganBillingBridgeService";

const SOURCE = "InvoicePaidActivationHandler";

/**
 * Handler INVOICE_PAID dari sisi pelanggan — activation guard supaya
 * pelanggan tidak otomatis di-aktifkan saat masih punya invoice unpaid lain
 * (untuk tipe REGULER). Tipe non-reguler (mis. PRABAYAR) selalu re-aktif.
 *
 * Error di-throw supaya BullMQ retry dengan exponential backoff.
 */
export async function handleInvoicePaidActivation(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const pelangganId = requirePayloadString(
    payload.pelangganId,
    "pelangganId",
    SOURCE,
  );

  const pelangganBridge = new PelangganBillingBridgeService();
  const customer = await pelangganBridge.findById(pelangganId);
  if (!customer) {
    logger.info(
      `[${SOURCE}] Pelanggan ${pelangganId} tidak ditemukan, skip activation`,
    );
    return;
  }

  const shouldActivate =
    customer.status !== "AKTIF" &&
    (customer.tipe !== "REGULER" ||
      (await FinanceRepositoryFacade.countUnpaidInvoicesForPelanggan(
        customer.id,
      )) === 0);

  if (!shouldActivate) {
    logger.info(
      `[${SOURCE}] Skip activation for ${pelangganId}; already AKTIF or has unpaid invoice`,
    );
    return;
  }

  await getPelangganService().updateStatusPelanggan(pelangganId, "AKTIF");
  logger.info(`[${SOURCE}] Customer ${pelangganId} activated after payment`);
}
