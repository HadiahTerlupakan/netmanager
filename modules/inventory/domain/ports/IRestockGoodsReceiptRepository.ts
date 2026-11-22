/**
 * Kontrak akses data untuk Lapor Barang Sampai dan Batalkan pada pengajuan
 * restock yang sudah disetujui.
 */

/** Baris barang pengajuan yang tidak ditolak atasan. */
export interface RestockRequestLineForReceipt {
  barangId: string;
  /** Jumlah yang berlaku: yang diajukan, atau yang disetujui atasan. */
  jumlah: number;
  barang?: { id: string; nama: string } | null;
}

/** Baris jasa pengajuan yang tidak ditolak atasan. */
export interface RestockRequestJasaForReceipt {
  statusKonfirmasi: string;
}

export interface RestockPurchaseRequestForReceipt {
  id: string;
  purchaseOrderId: string | null;
  gudangId: string;
  status: string;
  nomorRequest: string;
  /** Baris yang ditolak atasan tidak ikut dipesan, jadi tidak dimuat. */
  lines: RestockRequestLineForReceipt[];
  jasaItems: RestockRequestJasaForReceipt[];
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
  status: string;
  paymentStatus: string | null;
  /** Jumlah baris jasa di pesanan; pesanan berjasa tidak dibatalkan. */
  jasaItemCount: number;
  goodsReceiptIds: string[];
  /**
   * Data historis tahap pembelian (dihapus 2026-11-21): pesanan punya catatan
   * belanja yang tidak dibatalkan. Pesanan seperti itu tidak dibatalkan, sama
   * dengan penjaga pembatalan pesanan di repository.
   */
  hasLegacyPurchases: boolean;
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

/**
 * Penutupan selama pesanan gabungan masih dipakai pengajuan lain yang
 * terbuka: tidak ada sisa yang dicoret dan pesanan dibiarkan terbuka.
 * - SETTLE_REQUEST: hanya pengajuan ini yang selesai.
 * - CANCEL_REQUEST: hanya pengajuan ini yang dibatalkan.
 */
export type RestockRequestOnlySettlement = "SETTLE_REQUEST" | "CANCEL_REQUEST";

/**
 * Penutupan oleh pengajuan terakhir yang terbuka di pesanannya:
 * - SETTLE_ORDER: pengajuan dan pesanannya selesai.
 * - CANCEL_ORDER: pesanan belum tersentuh apa pun; pesanan dan pengajuannya
 *   dibatalkan.
 * - CANCEL_REQUEST_AND_SETTLE_ORDER: pengajuan dibatalkan; pesanan yang tidak
 *   boleh ikut dibatalkan ditutup selesai.
 */
export type RestockOrderSettlement =
  | "SETTLE_ORDER"
  | "CANCEL_ORDER"
  | "CANCEL_REQUEST_AND_SETTLE_ORDER";

/** Rencana penutupan bila pengajuan ini yang terakhir terbuka di pesanannya. */
export interface RestockOrderClosingPlan {
  settlement: RestockOrderSettlement;
  /**
   * Sisa semua item pesanan, dicoret bersyarat snapshot: tidak ada pengajuan
   * lain yang masih menunggunya.
   */
  cancellations: GuardedItemCancellation[];
}

export interface CloseRestockRequestInput {
  purchaseOrderId: string;
  purchaseRequestId: string;
  /** Dipakai bila pesanan masih dipakai pengajuan lain yang terbuka. */
  ifOtherRequestsOpen: RestockRequestOnlySettlement;
  /** Dipakai bila pengajuan ini yang terakhir terbuka di pesanannya. */
  ifLastOpenRequest: RestockOrderClosingPlan;
  actorId: string;
  cancelledAt: Date;
  /** Alasan admin; ditulis ke pengajuan bila penutupannya membatalkan pengajuan. */
  cancelReason?: string;
}

/**
 * Hasil penutupan. `isLastOpenRequest` menyebut rencana yang diterapkan:
 * true berarti sisa pesanan dicoret dan pesanannya ikut ditutup.
 */
export type CloseRestockRequestResult =
  | { isWritten: false }
  | { isWritten: true; isLastOpenRequest: boolean };

export interface CancelRequestWithoutOrderInput {
  purchaseRequestId: string;
  tenantId: string;
  cancelReason: string;
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

/** Membaca pengajuan beserta pesanannya, lalu menutup pengajuan secara bersyarat. */
export interface IRestockRequestClosureRepository {
  findPurchaseRequestForReceipt(
    id: string,
    tenantId: string,
  ): Promise<RestockPurchaseRequestForReceipt | null>;

  findPurchaseOrderWithItems(
    purchaseOrderId: string,
  ): Promise<RestockPurchaseOrderForReceipt | null>;

  /** Jumlah pengajuan yang memakai pesanan ini. */
  countPurchaseRequestsForPurchaseOrder(
    purchaseOrderId: string,
  ): Promise<number>;

  /**
   * Tutup pengajuan dalam satu transaksi yang diawali kunci baris pesanan.
   * Sesudah kunci didapat, pengajuan lain yang masih terbuka di pesanan itu
   * dibaca ulang: bila ada, `ifOtherRequestsOpen` diterapkan; bila tidak,
   * sisa item dicoret (hanya bila item belum berubah sejak dibaca) lalu
   * `ifLastOpenRequest` diterapkan. `isWritten: false` bila ada yang berubah
   * di tengah jalan; tidak ada yang tertulis.
   */
  closeRequest(
    input: CloseRestockRequestInput,
  ): Promise<CloseRestockRequestResult>;

  /**
   * Batalkan pengajuan yang sudah disetujui tetapi belum punya pesanan. False
   * bila statusnya berubah atau pesanannya baru saja dibuat.
   */
  cancelRequestWithoutOrder(
    input: CancelRequestWithoutOrderInput,
  ): Promise<boolean>;
}

/** Akses data Lapor Barang Sampai: penutupan, ganti barang, dan kenaikan pesanan. */
export interface IRestockGoodsReceiptRepository extends IRestockRequestClosureRepository {
  findBarangCandidates(
    barangIds: string[],
    tenantId: string,
  ): Promise<BarangSubstitutionCandidate[]>;

  applyItemSubstitutions(input: ApplyItemSubstitutionInput): Promise<void>;

  increaseItemQuantities(
    input: IncreaseItemQuantitiesInput,
  ): Promise<PurchaseOrderIncreaseUndo>;

  undoItemQuantityIncrease(undo: PurchaseOrderIncreaseUndo): Promise<void>;
}
