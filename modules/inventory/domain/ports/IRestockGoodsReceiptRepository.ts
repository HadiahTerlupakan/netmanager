/** Kontrak akses data untuk alur verifikasi kedatangan barang restock. */

export interface RestockPurchaseRequestForReceipt {
  id: string;
  purchaseOrderId: string | null;
  gudangId: string;
  status: string;
  nomorRequest: string;
}

export interface RestockPurchaseOrderItem {
  id: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  barang?: { id: string; nama: string } | null;
}

export interface RestockPurchaseOrderForReceipt {
  id: string;
  poNumber?: string | null;
  status?: string;
  items: RestockPurchaseOrderItem[];
}

export interface BarangSubstitutionCandidate {
  id: string;
  nama: string;
}

export interface ApplyItemSubstitutionInput {
  purchaseOrderId: string;
  tenantId: string;
  substitutions: Array<{
    purchaseOrderItemId: string;
    fromBarangId: string;
    toBarangId: string;
  }>;
}

export interface ApplyItemCancellationInput {
  purchaseOrderId: string;
  cancelledAt: Date;
  cancellations: Array<{
    purchaseOrderItemId: string;
    cancelledQuantity: number;
    reason: string;
  }>;
}

export interface IncreaseItemQuantitiesInput {
  purchaseOrderId: string;
  increases: Array<{ purchaseOrderItemId: string; extraQuantity: number }>;
}

/**
 * Kenaikan yang diterapkan ke PO, untuk dikembalikan bila GRN gagal dibuat.
 * Disimpan sebagai selisih, bukan snapshot, supaya perubahan lain pada PO di
 * antara keduanya tidak ikut tertimpa.
 */
export interface PurchaseOrderIncreaseUndo {
  purchaseOrderId: string;
  increases: Array<{ purchaseOrderItemId: string; extraQuantity: number }>;
  /** true bila kenaikan ini yang mengubah status bayar PAID menjadi PARTIAL. */
  markedUnderpaid: boolean;
}

export interface IRestockGoodsReceiptRepository {
  findPurchaseRequestForReceipt(
    id: string,
    tenantId: string,
  ): Promise<RestockPurchaseRequestForReceipt | null>;

  findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null>;

  findPurchaseOrderStatus(purchaseOrderId: string): Promise<string | null>;

  findBarangCandidates(
    barangIds: string[],
    tenantId: string,
  ): Promise<BarangSubstitutionCandidate[]>;

  applyItemSubstitutions(input: ApplyItemSubstitutionInput): Promise<void>;

  applyItemCancellations(input: ApplyItemCancellationInput): Promise<void>;

  increaseItemQuantities(
    input: IncreaseItemQuantitiesInput,
  ): Promise<PurchaseOrderIncreaseUndo>;

  undoItemQuantityIncrease(undo: PurchaseOrderIncreaseUndo): Promise<void>;

  hasOutstandingItems(purchaseOrderId: string): Promise<boolean>;

  markPurchaseOrderReceived(
    purchaseOrderId: string,
    actorId: string,
  ): Promise<void>;

  markPurchaseRequestReceived(purchaseRequestId: string): Promise<void>;
}
