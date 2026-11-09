import type {
  RestockPurchaseOrderForReceipt,
  RestockPurchaseRequestForReceipt,
} from "../domain/ports/IRestockGoodsReceiptRepository";
import type { RestockPurchaseEvidence } from "../domain/restock-receipt-eligibility";
import {
  RestockCancellationInvalidError,
  withClosingCancellations,
  type ApplyRestockCancellationInput,
} from "./RestockItemCancellationService";
import {
  RestockReceiptInvalidError,
  type ReceiveRestockRequestInput,
} from "./restock-goods-receipt.contracts";

/*
 * Keadaan satu penyimpanan "Catat Barang Datang" yang dipakai bersama oleh
 * pencatatan kiriman dan penutupan tanpa kiriman.
 */

/** Data pengajuan & pesanan yang sudah dibaca untuk satu penyimpanan. */
export interface ReceiptContext {
  input: ReceiveRestockRequestInput;
  purchaseRequest: RestockPurchaseRequestForReceipt;
  purchaseOrder: RestockPurchaseOrderForReceipt;
  linkedRequestCount: number;
  /**
   * Barang milik pengajuan ini. null = seluruh pesanan milik pengajuan ini
   * (atau data barangnya tidak tersedia).
   */
  ownedBarangIds: ReadonlySet<string> | null;
  evidence: RestockPurchaseEvidence;
  /**
   * Data lama atau pesanan gabungan: barang boleh dicatat datang tanpa
   * laporan belanja, sampai seluruh sisa pesanan.
   */
  isExemptFromPurchaseReport: boolean;
}

/**
 * Pencoretan diterapkan setelah GRN karena pembuatan GRN mensyaratkan masih
 * adanya sisa pesanan pada Purchase Order, tapi diperiksa sebelumnya.
 * Menutup pesanan hanya mencoret barang milik pengajuan ini.
 */
export function buildCancellationRequest(params: {
  context: ReceiptContext;
  grnItems: Array<{ purchaseOrderItemId: string; quantity: number }>;
}): ApplyRestockCancellationInput {
  const { input, purchaseOrder, purchaseRequest, ownedBarangIds } =
    params.context;
  const receivedQuantityByItemId = params.grnItems.reduce<
    Record<string, number>
  >((acc, item) => {
    acc[item.purchaseOrderItemId] =
      (acc[item.purchaseOrderItemId] ?? 0) + item.quantity;
    return acc;
  }, {});

  const requestedCancellations = input.cancellations ?? {};
  return {
    purchaseOrderId: purchaseOrder.id,
    purchaseOrderItems: purchaseOrder.items,
    cancellations: input.closePO
      ? withClosingCancellations(
          requestedCancellations,
          purchaseOrder.items,
          receivedQuantityByItemId,
          ownedBarangIds,
        )
      : requestedCancellations,
    receivedQuantityByItemId,
    tenantId: input.tenantId,
    actorId: input.actorId,
    referenceNumber: purchaseRequest.nomorRequest,
  };
}

/** Jalankan langkah pencoretan; galat isian diterjemahkan untuk petugas. */
export async function runCancellationStep<T>(
  step: () => T | Promise<T>,
): Promise<T> {
  try {
    return await step();
  } catch (error) {
    if (error instanceof RestockCancellationInvalidError) {
      throw new RestockReceiptInvalidError(error.message);
    }
    throw error;
  }
}
