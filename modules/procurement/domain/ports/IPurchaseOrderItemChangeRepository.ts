import type { ProcurementPaymentStatus } from "./IPurchaseOrderRepository";

export type PurchaseOrderStatusValue =
  | "DRAFT"
  | "ORDERED"
  | "PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

export interface PurchaseOrderItemForChange {
  id: string;
  barangId: string;
  barangName: string;
  quantity: number;
  receivedQuantity: number;
  cancelledQuantity: number;
  unitPrice: number;
}

export interface PurchaseOrderForItemChange {
  id: string;
  poNumber: string;
  tenantId: string | null;
  status: PurchaseOrderStatusValue;
  grandTotal: number;
  ppnRate: number;
  items: PurchaseOrderItemForChange[];
  /** Pengajuan yang digabung ke PO ini, yang paling lama lebih dulu. */
  purchaseRequestIds: string[];
}

export interface PurchaseOrderItemAddition {
  barangId: string;
  quantity: number;
  unitPrice: number;
}

export interface ApplyPurchaseOrderItemChangeInput {
  purchaseOrderId: string;
  poNumber: string;
  tenantId: string | null;
  actorId: string;
  quantityChanges: Array<{ purchaseOrderItemId: string; quantity: number }>;
  additions: PurchaseOrderItemAddition[];
  /** Pengajuan yang menerima baris tambahan agar tampil di verifikasi restock. */
  purchaseRequestId: string | null;
}

export interface PurchaseOrderItemChangeResult {
  status: PurchaseOrderStatusValue;
  paymentStatus: ProcurementPaymentStatus;
  grandTotal: number;
}

export interface IPurchaseOrderItemChangeRepository {
  findForItemChange(id: string): Promise<PurchaseOrderForItemChange | null>;

  findBarangs(
    barangIds: string[],
    tenantId: string | null,
  ): Promise<Array<{ id: string; nama: string }>>;

  /**
   * Terapkan perubahan dalam satu transaksi. `assertStillValid` dipanggil
   * dengan PO yang sudah dikunci dan dibaca ulang; lemparan error membatalkan
   * seluruh perubahan.
   */
  applyItemChange(
    input: ApplyPurchaseOrderItemChangeInput,
    assertStillValid: (po: PurchaseOrderForItemChange) => Promise<void>,
  ): Promise<PurchaseOrderItemChangeResult>;
}
