import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import {
  getPurchaseOrderRepository,
  getSupplierService,
} from "@/modules/procurement";
import { getPphService, getPpnService } from "../../index";
import { classifyPph } from "../PphClassifier";

const SOURCE = "PurchaseOrderPaidTaxHandler";

/**
 * Handles PURCHASE_ORDER_PAID event to record PPN Masukan dan PPh 23/4(2).
 *
 * Resolusi PPh:
 * 1. Supplier `defaultPphCategory` (jasa/sewa/sewa_tanah) — diambil via
 *    procurement public API (`getSupplierService`).
 * 2. PO tidak punya expense category, jadi tanpa fallback string-match.
 *
 * Resolusi PPN:
 * - PO punya `ppnAmount` & `ppnRate` eksplisit, plus optional `fakturPajakNo`,
 *   `fakturPajakDate`, `vendorNpwp` — dipakai sebagai metadata DJP claim.
 *   Bila `vendorNpwp` di PO kosong, fallback ke supplier.npwp dari master vendor.
 *
 * Skip silently jika tenant bukan PKP atau COA belum di-seed.
 */
export async function handlePurchaseOrderPaidTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const purchaseOrderId = requirePayloadString(
    payload.purchaseOrderId,
    "purchaseOrderId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const paidAt = requirePayloadString(payload.paidAt, "paidAt", SOURCE);
  const entryDate = new Date(paidAt);

  try {
    const po = await getPurchaseOrderRepository().findById(purchaseOrderId);

    if (!po) {
      logger.warn(
        `[${SOURCE}] PurchaseOrder ${purchaseOrderId} not found, skipping`,
      );
      return;
    }

    const supplier = po.supplierId
      ? await getSupplierService()
          .getById(po.supplierId)
          .catch((): null => null)
      : null;

    const grandTotal = Number(po.grandTotal);
    const counterpartNpwp = po.vendorNpwp ?? supplier?.npwp ?? null;

    // 1. Record PPh berdasarkan defaultPphCategory supplier
    const pphClassification = classifyPph({
      categoryType: "",
      categoryName: "",
      vendorDefaultPphCategory: supplier?.defaultPphCategory ?? null,
    });

    const pphService = getPphService();

    if (pphClassification === "sewa_tanah") {
      await pphService.recordPph4({
        tenantId,
        expenseId: purchaseOrderId,
        amount: grandTotal,
        expenseDate: entryDate,
        sourceRefType: "PurchaseOrder",
      });
    } else if (pphClassification === "sewa") {
      await pphService.recordPph23({
        tenantId,
        expenseId: purchaseOrderId,
        amount: grandTotal,
        category: "sewa",
        expenseDate: entryDate,
        sourceRefType: "PurchaseOrder",
      });
    } else if (pphClassification === "jasa") {
      await pphService.recordPph23({
        tenantId,
        expenseId: purchaseOrderId,
        amount: grandTotal,
        category: "jasa",
        expenseDate: entryDate,
        sourceRefType: "PurchaseOrder",
      });
    }

    // 2. Record PPN Masukan jika PO punya komponen PPN
    if (Number(po.ppnAmount) > 0) {
      const ppnService = getPpnService();
      await ppnService.recordPpnMasukan({
        tenantId,
        expenseId: purchaseOrderId,
        expenseAmount: grandTotal,
        expenseDate: entryDate,
        sourceRefType: "PurchaseOrder",
        fakturPajakNo: po.fakturPajakNo ?? null,
        fakturPajakDate: po.fakturPajakDate ?? null,
        counterpartNpwp,
      });
    }
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
