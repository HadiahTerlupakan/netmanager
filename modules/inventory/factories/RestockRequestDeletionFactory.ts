import { prisma } from "@/modules/database";
import {
  getPurchaseOrderService,
  PurchaseOrderHasPurchasesError,
  PurchaseOrderNotEditableError,
  PurchaseOrderNotFoundError,
} from "@/modules/procurement";

import { InventoryPurchaseRequestRepository } from "../repositories/InventoryPurchaseRequestRepository";
import { RestockRequestRedisLock } from "../repositories/RestockRequestRedisLock";
import {
  RestockRequestDeletionService,
  type RestockOrderRemovalOutcome,
  type RestockPurchaseOrderRemover,
} from "../services/RestockRequestDeletionService";

/**
 * Terjemahkan galat penghapusan pesanan dari procurement; galat lain dilempar
 * ulang. Pesanan yang sudah tidak ada tidak menghalangi penghapusan
 * pengajuannya. Catatan belanja lama (purchase_records → purchase_orders, FK
 * RESTRICT) memblokir penghapusan pesanan: ini pembacaan data historis, karena
 * belanja tidak dicatat lagi. `PurchaseOrderHasPurchasesError` turunan
 * `PurchaseOrderNotEditableError`, jadi diperiksa lebih dulu.
 */
function toOrderRemovalOutcome(error: unknown): RestockOrderRemovalOutcome {
  if (error instanceof PurchaseOrderNotFoundError) return "REMOVED";
  if (error instanceof PurchaseOrderHasPurchasesError) {
    return "HAS_LEGACY_PURCHASES";
  }
  if (error instanceof PurchaseOrderNotEditableError) return "LOCKED";
  throw error;
}

/** Hapus pesanan pengajuan lewat service pesanan procurement. */
const procurementPurchaseOrderRemover: RestockPurchaseOrderRemover = {
  async removePurchaseOrder(purchaseOrderId) {
    try {
      await getPurchaseOrderService().delete(purchaseOrderId);
      return "REMOVED";
    } catch (error: unknown) {
      return toOrderRemovalOutcome(error);
    }
  },
};

/** Rakit service hapus pengajuan restock beserta dependency konkretnya. */
export function createRestockRequestDeletionService(): RestockRequestDeletionService {
  return new RestockRequestDeletionService(
    new InventoryPurchaseRequestRepository(prisma),
    procurementPurchaseOrderRemover,
    new RestockRequestRedisLock(),
  );
}
