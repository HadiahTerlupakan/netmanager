import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import { getPpnService } from "../../index";

const SOURCE = "GoodsReceiptCreatedTaxHandler";

interface ItemPayload {
  quantity: number;
  unitPrice: string;
}

/**
 * Handler GOODS_RECEIPT_CREATED → record PPN Masukan.
 *
 * Timing: PPN Masukan dicatat saat **barang diterima (GRN)**, bukan saat
 * PO dibayar. Alasan compliance: faktur pajak biasanya dikeluarkan vendor
 * bersamaan dengan barang. Mencatat PPN saat bayar bisa miss reporting
 * period DJP kalau pembayaran beda bulan dengan tanggal faktur.
 *
 * `expenseId` di tax_transactions diisi `goodsReceiptId` (bukan PO id) —
 * unique per GRN supaya idempotent (kalau retry event, tidak duplicate).
 */
export async function handleGoodsReceiptCreatedTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const goodsReceiptId = requirePayloadString(
    payload.goodsReceiptId,
    "goodsReceiptId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const receivedAt = requirePayloadString(
    payload.receivedAt,
    "receivedAt",
    SOURCE,
  );
  const entryDate = new Date(receivedAt);

  const ppnAmount = Number(payload.ppnAmount ?? 0);
  if (ppnAmount <= 0) {
    logger.debug(`[${SOURCE}] GRN ${goodsReceiptId} tidak punya PPN, skip`);
    return;
  }

  const items = (payload.items as ItemPayload[]) ?? [];
  const subtotal = items.reduce(
    (sum, it) => sum + Number(it.unitPrice) * Number(it.quantity),
    0,
  );

  const fakturPajakNo =
    typeof payload.fakturPajakNo === "string" ? payload.fakturPajakNo : null;
  const fakturPajakDate =
    typeof payload.fakturPajakDate === "string"
      ? new Date(payload.fakturPajakDate)
      : null;
  const counterpartNpwp =
    typeof payload.vendorNpwp === "string" ? payload.vendorNpwp : null;

  try {
    const ppnService = getPpnService();
    await ppnService.recordPpnMasukan({
      tenantId,
      expenseId: goodsReceiptId,
      expenseAmount: subtotal,
      expenseDate: entryDate,
      sourceRefType: "GoodsReceipt",
      fakturPajakNo,
      fakturPajakDate,
      counterpartNpwp,
    });
    logger.info(
      `[${SOURCE}] PPN Masukan recorded for GRN ${goodsReceiptId} (PPN ${ppnAmount})`,
    );
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
