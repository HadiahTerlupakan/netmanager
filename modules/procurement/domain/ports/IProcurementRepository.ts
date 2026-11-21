import type { PurchaseOrderEntity } from "../entities/PurchaseOrder";
import type {
  PurchaseRequestEntity,
  PurchaseRequestSummaryEntity,
} from "../entities/PurchaseRequest";

export interface CreatePurchaseOrderItemInput {
  id: string;
  barangId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tenantId: string | null;
}

export interface CreatePurchaseOrderJasaItemInput {
  id: string;
  jasaId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tenantId: string | null;
}

export interface CreatePurchaseOrderInput {
  id: string;
  poNumber: string;
  supplierId: string | null;
  createdBy: string;
  tenantId: string | null;
  totalAmount: number;
  items: CreatePurchaseOrderItemInput[];
  jasaItems?: CreatePurchaseOrderJasaItemInput[];
  prIds: string[];
}

export interface PurchaseRequestListFilter {
  tenantId: string | null;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface PurchaseRequestListResult {
  data: PurchaseRequestSummaryEntity[];
  total: number;
  page: number;
  limit: number;
}

export interface IProcurementRepository {
  /** Mengambil purchase request APPROVED yang masih eligible untuk dibuatkan PO. */
  findApprovedPRs(prIds: string[]): Promise<PurchaseRequestEntity[]>;

  /** Mengambil purchase order terakhir berdasarkan prefix nomor PO. */
  findLastPOByNumberPrefix(
    prefix: string,
    tenantId?: string | null,
  ): Promise<PurchaseOrderEntity | null>;

  /**
   * Membuat PO DRAFT beserta itemnya dan menghubungkan purchase request terkait
   * dalam satu transaksi. Pengajuan diklaim lebih dulu (APPROVED tanpa PO
   * menjadi ORDERED); bila ada yang sudah diklaim pesanan lain atau statusnya
   * berubah, `PurchaseRequestAlreadyOrderedError` dilempar dan tidak ada yang
   * tersimpan.
   */
  createPOWithItems(
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderEntity>;

  /** Membuat nomor purchase order baru berdasarkan tenant dan periode aktif. */
  generatePONumber(tenantId?: string | null): Promise<string>;

  /** Listing ringkas purchase request untuk view procurement (read-only). */
  listPurchaseRequests(
    filter: PurchaseRequestListFilter,
  ): Promise<PurchaseRequestListResult>;
}
