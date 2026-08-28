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
  barang?: { id: string; nama: string } | null;
}

export interface RestockPurchaseOrderForReceipt {
  id: string;
  poNumber?: string | null;
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

  markPurchaseOrderReceived(
    purchaseOrderId: string,
    actorId: string,
  ): Promise<void>;

  markPurchaseRequestReceived(purchaseRequestId: string): Promise<void>;
}
