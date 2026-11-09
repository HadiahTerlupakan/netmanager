/** Kontrak akses data untuk alur verifikasi kedatangan barang restock. */

export interface RestockPurchaseRequestForReceipt {
  id: string;
  purchaseOrderId: string | null;
  gudangId: string;
  status: string;
  nomorRequest: string;
  /** Barang di baris pengajuan yang tidak ditolak atasan. */
  receivableBarangIds?: string[];
}

export interface RestockPurchaseOrderItem {
  id: string;
  barangId: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  /** Jumlah tercatat dibeli lewat catatan belanja. */
  purchasedQuantity?: number;
  barang?: { id: string; nama: string } | null;
}

export interface RestockPurchaseOrderForReceipt {
  id: string;
  poNumber?: string | null;
  status?: string;
  /** Tanggal barang ditandai sudah dibeli; null bila belum pernah dicatat. */
  issuedAt?: Date | null;
  processedById?: string | null;
  tenantId?: string | null;
  paymentStatus?: string | null;
  /** Jumlah baris jasa di pesanan; pesanan berjasa tidak dibatalkan. */
  jasaItemCount?: number;
  goodsReceiptCount?: number;
  items: RestockPurchaseOrderItem[];
}

/** Pesanan setelah ditandai sudah dibeli. */
export interface RestockOrderedPurchaseOrder {
  id: string;
  poNumber: string;
  status: string;
  processedById: string | null;
  issuedAt: Date | null;
}

/** Catatan siapa dan kapan barang pesanan dibeli ke toko. */
export interface PurchaseOrderPurchaseRecord {
  purchaseOrderId: string;
  processedById: string;
  issuedAt: Date;
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

/** Snapshot item saat dibaca; pencoretan ditolak bila item sudah berubah. */
export interface GuardedItemCancellation {
  purchaseOrderItemId: string;
  cancelledQuantity: number;
  reason: string;
  expected: {
    quantity: number;
    receivedQuantity: number;
    cancelledQuantity: number;
  };
}

/** Akibat penyimpanan terhadap status pesanan & pengajuan. */
export type RestockSettlementKind =
  | "KEEP_OPEN"
  | "SETTLE_REQUEST"
  | "SETTLE_ORDER"
  | "CANCEL_ORDER";

export interface ApplyReceiptSettlementInput {
  purchaseOrderId: string;
  purchaseRequestId: string;
  settlement: RestockSettlementKind;
  actorId: string;
}

export interface FinishWithoutDeliveryInput extends ApplyReceiptSettlementInput {
  cancelledAt: Date;
  cancellations: GuardedItemCancellation[];
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

  /**
   * Apakah masih ada item yang belum datang maupun dicoret. `barangIds`
   * membatasi pemeriksaan ke barang milik satu pengajuan.
   */
  hasOutstandingItems(
    purchaseOrderId: string,
    barangIds?: string[],
  ): Promise<boolean>;

  /** Jumlah pengajuan yang memakai pesanan ini. */
  countPurchaseRequestsForPurchaseOrder(
    purchaseOrderId: string,
  ): Promise<number>;

  /**
   * Terapkan akibat penyimpanan ke status pesanan & pengajuan. False bila
   * pembatalan ditolak karena pesanan sudah berubah (misalnya baru menerima
   * barang).
   */
  applyReceiptSettlement(input: ApplyReceiptSettlementInput): Promise<boolean>;

  /**
   * Selesaikan pesanan tanpa kiriman dalam satu transaksi: coret sisa barang
   * (hanya bila item belum berubah sejak dibaca) lalu terapkan statusnya.
   * False bila ada yang berubah di tengah jalan; tidak ada yang tertulis.
   */
  finishPurchaseOrderWithoutDelivery(
    input: FinishWithoutDeliveryInput,
  ): Promise<boolean>;

  /**
   * DRAFT → ORDERED beserta pembeli dan tanggal belinya, lalu kembalikan
   * pesanan terbarunya. Null bila pesanan sudah tidak DRAFT (misalnya sudah
   * ditandai orang lain bersamaan).
   */
  markPurchaseOrderOrdered(
    record: PurchaseOrderPurchaseRecord,
  ): Promise<RestockOrderedPurchaseOrder | null>;

  /** Catat pembeli dan tanggal beli tanpa mengubah status pesanan. */
  recordPurchaseOrderPurchase(
    record: PurchaseOrderPurchaseRecord,
  ): Promise<void>;
}
