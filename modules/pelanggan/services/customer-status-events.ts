import { CustomerEventDispatcher } from "@/modules/events";
import { logger } from "@/lib/logger";

export type CustomerStatusChange = {
  customerId: string;
  customerName: string;
  oldStatus: string;
  newStatus: string;
  tenantId?: string;
};

type ArrearsFields = { arrearsInvoiceNumber?: string; arrearsAmount?: number };

/**
 * Terbitkan event transisi status pelanggan. Satu-satunya tempat pemetaan
 * status → event, dipakai aksi baris daftar pelanggan dan form Edit Pelanggan.
 *
 * ISOLIR membawa tagihan lewat jatuh tempo bila ada, supaya notifikasi
 * pelanggan hanya menyebut tunggakan saat memang ada tunggakan.
 */
export async function publishCustomerStatusChange(
  change: CustomerStatusChange,
): Promise<void> {
  if (change.newStatus === "ISOLIR") {
    await CustomerEventDispatcher.onIsolated({
      ...change,
      ...(await resolveArrears(change.customerId)),
    });
    return;
  }

  if (change.newStatus === "AKTIF") {
    await CustomerEventDispatcher.onActivated(change);
    return;
  }

  // NONAKTIF, DISMANTLE, MAINTENANCE → suspended
  await CustomerEventDispatcher.onSuspended(change);
}

/**
 * Gagal membaca billing tidak boleh menahan event isolir (sinkronisasi
 * jaringan ikut menumpang padanya); tanpa bukti tunggakan, pesannya netral.
 */
async function resolveArrears(pelangganId: string): Promise<ArrearsFields> {
  try {
    const { FinanceRepositoryFacade } = await import("@/modules/finance");
    const invoice =
      await FinanceRepositoryFacade.findOverdueInvoiceForPelanggan(pelangganId);
    if (!invoice) return {};
    return {
      arrearsInvoiceNumber: invoice.invoiceNumber,
      arrearsAmount: invoice.amountDue,
    };
  } catch (error) {
    logger.warn(
      `[Pelanggan] Gagal membaca tunggakan ${pelangganId}; notifikasi isolir memakai pesan netral`,
      error instanceof Error ? error : undefined,
    );
    return {};
  }
}
