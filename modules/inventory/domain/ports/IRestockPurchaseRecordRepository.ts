/** Kontrak akses data untuk mencatat belanja (satu kali belanja di satu toko). */

/** Item pesanan beserta jumlah yang dipakai untuk menghitung sisa belanja. */
export interface RestockPurchaseContextItem {
  id: string;
  barangId: string;
  quantity: number;
  cancelledQuantity: number;
  receivedQuantity: number;
  purchasedQuantity: number;
  barang: { nama: string; satuan: string | null } | null;
}

/** Pengajuan beserta pesanannya, dibaca sebelum belanja dicatat. */
export interface RestockPurchaseContext {
  request: {
    id: string;
    nomorRequest: string;
    status: string;
    purchaseOrderId: string | null;
    /** Barang di baris pengajuan yang tidak ditolak atasan. */
    receivableBarangIds: string[];
  };
  purchaseOrder: {
    id: string;
    poNumber: string;
    status: string;
    tenantId: string | null;
    /** Jumlah pengajuan yang memakai pesanan ini; lebih dari 1 = gabungan. */
    linkedRequestCount: number;
    items: RestockPurchaseContextItem[];
  } | null;
}

/** Satu baris belanja yang sudah lolos pemeriksaan, dengan snapshot penjaganya. */
export interface CreatePurchaseRecordLine {
  purchaseOrderItemId: string;
  /** Barang saat dibeli; item pesanan bisa diganti barangnya kemudian. */
  barangId: string;
  quantity: number;
  unitPrice: number | null;
  /** Keadaan item saat dibaca; penulisan ditolak bila sudah berubah. */
  expected: { quantity: number; cancelledQuantity: number };
}

/** Asal catatan belanja: dari aplikasi atau dari link tanpa login. */
export type PurchaseRecordSourceKind = "ADMIN" | "PUBLIC_LINK";

export interface CreatePurchaseRecordInput {
  purchaseOrderId: string;
  /** Pengajuan yang dicatat; link aktifnya dicabut bila semua sudah dibeli. */
  purchaseRequestId: string;
  /** Barang milik pengajuan (baris tidak ditolak), untuk cek "semua dibeli". */
  receivableBarangIds: string[];
  tenantId: string;
  recordedById: string;
  storeName: string;
  supplierId: string | null;
  purchasedAt: Date;
  /** Tanggal beli pesanan bila belanja ini mengubahnya dari DRAFT. */
  issuedAt: Date;
  notes: string | null;
  fotoNota: string[];
  lines: CreatePurchaseRecordLine[];
  buyerName: string | null;
  /** Kunci objek tanda tangan di penyimpanan; tidak pernah ikut ke tampilan. */
  buyerSignatureKey: string | null;
  source: PurchaseRecordSourceKind;
  /** Diisi untuk catatan lewat link; link dikunci & diperiksa di transaksi. */
  purchaseLinkId: string | null;
  clientRequestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Catatan belanja seperti yang ditampilkan ke petugas. */
export interface RestockPurchaseRecordView {
  id: string;
  storeName: string;
  supplierId: string | null;
  purchasedAt: Date;
  createdAt: Date;
  recordedBy: { name: string | null } | null;
  /** Nama yang belanja; untuk catatan lewat link ini yang ditampilkan. */
  buyerName: string | null;
  source: PurchaseRecordSourceKind;
  hasSignature: boolean;
  notes: string | null;
  fotoNota: string[];
  /** Diisi bila catatan dibatalkan admin; tidak lagi dihitung sebagai belanja. */
  voidedAt: Date | null;
  voidedBy: { name: string | null } | null;
  voidReason: string | null;
  items: Array<{
    id: string;
    purchaseOrderItemId: string;
    barangId: string;
    nama: string | null;
    satuan: string | null;
    quantity: number;
    unitPrice: number | null;
  }>;
}

export type CreatePurchaseRecordOutcome =
  | {
      kind: "CREATED";
      record: RestockPurchaseRecordView;
      previousStatus: string;
      purchaseOrderStatus: string;
      items: RestockPurchaseContextItem[];
      /** Jumlah link pengajuan yang dicabut karena semua barang sudah dibeli. */
      revokedLinkCount: number;
    }
  /** Pesanan sudah RECEIVED/CANCELLED saat dikunci. */
  | { kind: "CLOSED" }
  /** Pesanan atau itemnya berubah di tengah jalan; tidak ada yang tertulis. */
  | { kind: "CONFLICT" }
  /**
   * Link sudah dicabut/kedaluwarsa, atau pesanannya kini dipakai lebih dari
   * satu pengajuan, saat dikunci; tidak ada yang tertulis.
   */
  | { kind: "LINK_INACTIVE" }
  /** Link sudah mencapai batas jumlah catatan; tidak ada yang tertulis. */
  | { kind: "LINK_LIMIT" }
  /** Kiriman ulang dengan `clientRequestId` yang sama; catatan lama dikembalikan. */
  | { kind: "DUPLICATE"; record: RestockPurchaseRecordView };

export interface VoidPurchaseRecordInput {
  purchaseRequestId: string;
  recordId: string;
  tenantId: string;
  actorId: string;
  reason: string;
  now: Date;
}

/**
 * Jejak catatan yang dibatalkan, disalin ke log aktivitas supaya tetap ada
 * walau catatannya ikut terhapus bersama pesanan.
 */
export interface PurchaseRecordVoidAudit {
  /** Kunci objek tanda tangan pembeli di penyimpanan. */
  buyerSignatureKey: string | null;
  purchaseLinkId: string | null;
  clientRequestId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export type VoidPurchaseRecordOutcome =
  | {
      kind: "VOIDED";
      record: RestockPurchaseRecordView;
      /** Untuk log aktivitas saja; tidak pernah dikirim ke tampilan. */
      audit: PurchaseRecordVoidAudit;
      poNumber: string;
    }
  /** Catatan tidak ada, bukan milik pesanan pengajuan ini, atau tenant lain. */
  | { kind: "NOT_FOUND" }
  | { kind: "ALREADY_VOIDED" }
  /**
   * Pesanan gabungan dan catatan ini juga memuat barang pengajuan lain:
   * hanya bisa dibatalkan dari pengajuan yang memiliki semua barangnya.
   */
  | { kind: "SHARED_WITH_OTHER_REQUEST" }
  /** Pesanan sudah RECEIVED/CANCELLED. */
  | { kind: "CLOSED" };

export interface IRestockPurchaseRecordRepository {
  /** Pengajuan milik tenant beserta pesanan & itemnya; null bila tidak ada. */
  findPurchaseContext(
    purchaseRequestId: string,
    tenantId: string,
  ): Promise<RestockPurchaseContext | null>;

  /** True bila toko terdaftar milik tenant dan tidak di-blacklist. */
  isActiveSupplier(supplierId: string, tenantId: string): Promise<boolean>;

  /**
   * Simpan catatan belanja dan naikkan jumlah dibeli per item dalam satu
   * transaksi. Belanja pertama pada pesanan DRAFT mengubahnya jadi ORDERED.
   */
  createPurchaseRecord(
    input: CreatePurchaseRecordInput,
  ): Promise<CreatePurchaseRecordOutcome>;

  /**
   * Batalkan catatan belanja (soft-void) dan turunkan jumlah dibeli tiap
   * barisnya, di bawah kunci pesanan yang sama dengan pencatatan belanja.
   */
  voidPurchaseRecord(
    input: VoidPurchaseRecordInput,
  ): Promise<VoidPurchaseRecordOutcome>;

  /**
   * Catatan lewat link dengan `clientRequestId` ini yang tidak dibatalkan;
   * null bila belum ada.
   */
  findByClientRequestId(
    purchaseLinkId: string,
    clientRequestId: string,
    tenantId: string,
  ): Promise<RestockPurchaseRecordView | null>;

  /**
   * Kunci tanda tangan catatan belanja, hanya bila catatan itu milik pesanan
   * pengajuan ini, di tenant ini, dan memuat minimal satu barang milik
   * pengajuan (penting untuk pesanan gabungan).
   */
  findSignatureKey(input: {
    purchaseRequestId: string;
    recordId: string;
    tenantId: string;
  }): Promise<string | null>;
}
