/** Keputusan approver per baris pengajuan. PENDING = baris lama / tambahan change-order. */
export type RestockLineApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Field keputusan per baris yang dikirim GET list/detail pengajuan. */
interface RestockLineApprovalFields {
  statusApproval?: RestockLineApprovalStatus;
  catatanApproval?: string | null;
  /** Jumlah yang semula diajukan; hanya terisi bila approver mengubah jumlah. */
  jumlahDiminta?: number | null;
}

export interface RestockBarangSummary {
  id: string;
  nama: string;
  kode: string;
  satuan: string;
}

export interface PurchaseRequestItem extends RestockLineApprovalFields {
  id: string;
  barangId: string;
  jumlah: number;
  /** Jumlah di item PO; bisa lebih besar dari `jumlah` bila PO menggabungkan pengajuan. */
  orderedQuantity?: number;
  receivedQuantity: number;
  cancelledQuantity?: number;
  cancelReason?: string | null;
  /** Item PO untuk catatan belanja; null bila ditolak / belum ada PO. Pada pesanan gabungan dipakai bersama. */
  purchaseOrderItemId?: string | null;
  /** Jumlah tercatat dibeli (level item PO; pesanan gabungan = total semua pengajuan). */
  purchasedQuantity?: number;
  keterangan?: string | null;
  barang: { nama: string; kode: string; satuan: string };
  /** Barang yang semula diajukan; hanya terisi bila approver menggantinya. */
  barangIdDiminta?: string | null;
  barangDiminta?: RestockBarangSummary | null;
}

export interface PurchaseRequestJasaItem extends RestockLineApprovalFields {
  id: string;
  jasaId: string;
  jumlah: number;
  hargaPerUnit: number;
  totalHarga: number;
  keterangan?: string | null;
  tanggalSelesai?: string | null;
  buktiSelesai?: string[];
  statusKonfirmasi: "PENDING" | "SELESAI";
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  jasa: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    hargaEstimasi?: number;
  };
}

/** Map barangId asli (di pengajuan) → barangId pengganti yang benar-benar datang. */
export type RestockSubstitutionMap = Record<string, string>;

/** Map barangId → alasan sisa barang tidak jadi datang. */
export type RestockCancellationMap = Record<string, string>;

/** barangId → alasan barang datang melebihi sisa pesanan. */
export type RestockOverReceiptMap = Record<string, string>;

/** Satu barang di satu kiriman (GRN). */
export interface GoodsReceiptLineSummary {
  barangId: string;
  /** null bila data barangnya sudah tidak ada. */
  nama: string | null;
  satuan: string | null;
  quantity: number;
}

/** Satu kiriman barang yang sudah dicatat di gudang. */
export interface GoodsReceiptSummary {
  id: string;
  grnNumber: string;
  fotoBukti: string[];
  receivedAt?: string | null;
  receivedBy?: { name: string } | null;
  items?: GoodsReceiptLineSummary[];
}

/** Satu barang di satu catatan belanja. */
export interface PurchaseRecordLineSummary {
  id: string;
  purchaseOrderItemId: string;
  /** Snapshot barang saat dibeli. */
  barangId: string;
  nama: string | null;
  satuan: string | null;
  quantity: number;
  unitPrice: number | null;
}

/** Satu kali belanja di satu toko. */
export interface PurchaseRecordSummary {
  id: string;
  storeName: string;
  supplierId: string | null;
  /** ISO, pukul 12.00 WIB pada tanggal belanja. */
  purchasedAt: string;
  /** ISO. */
  createdAt: string;
  /** Untuk catatan lewat link: admin pembuat link, bukan yang belanja. */
  recordedBy: { name: string | null } | null;
  /** Nama yang belanja; tampilkan ini lebih dulu daripada `recordedBy`. */
  buyerName: string | null;
  source: "ADMIN" | "PUBLIC_LINK";
  /** Gambar di /api/inventory/restock/requests/[id]/purchases/[recordId]/signature. */
  hasSignature: boolean;
  notes: string | null;
  fotoNota: string[];
  /** ISO; diisi bila catatan dibatalkan admin (tidak dihitung sebagai belanja). */
  voidedAt?: string | null;
  voidedBy?: { name: string | null } | null;
  voidReason?: string | null;
  /** Hanya baris milik pengajuan ini. */
  items: PurchaseRecordLineSummary[];
}

/** Alasan link belanja boleh/tidak boleh dibuat. */
export type PurchaseLinkAvailability =
  | "AVAILABLE"
  | "NOT_APPROVED"
  | "ALL_PURCHASED"
  | "CLOSED"
  | "MERGED_ORDER"
  | "STORAGE_OFF";

/** Info link belanja aktif (tanpa URL; URL hanya diberikan sekali). */
export interface PurchaseLinkInfo {
  id: string;
  /** ISO. */
  createdAt: string;
  /** ISO. */
  expiresAt: string;
  /** ISO. */
  lastUsedAt: string | null;
  createdByName: string | null;
}

/** GET /api/inventory/restock/requests/[id]/purchase-link. */
export interface PurchaseLinkStatus {
  /** Null bila belum ada link aktif ATAU availability bukan "AVAILABLE". */
  link: PurchaseLinkInfo | null;
  availability: PurchaseLinkAvailability;
}

/** POST /api/inventory/restock/requests/[id]/purchase-link (201). */
export interface PurchaseLinkCreated {
  link: PurchaseLinkInfo;
  /**
   * Satu-satunya kesempatan melihat link. Bisa relatif ("/belanja#…") bila
   * URL situs belum diatur; lengkapi dengan getPublicSiteUrl().
   */
  url: string;
}

export interface PurchaseOrderSummary {
  id?: string | null;
  poNumber?: string | null;
  status?: string | null;
  /** Kapan barang ditandai sudah dibeli; null untuk data lama. */
  issuedAt?: string | null;
  processedBy?: { name: string } | null;
  /** UNPAID | PARTIAL | PAID; pesanan yang sudah dibayar tidak dibatalkan. */
  paymentStatus?: string | null;
  _count?: { purchaseRequests?: number; jasaItems?: number };
  goodsReceipts?: GoodsReceiptSummary[];
}

export interface PurchaseRequest {
  id: string;
  nomorRequest: string;
  status:
    | "DRAFT"
    | "SUBMITTED"
    | "APPROVED"
    | "REJECTED"
    | "ORDERED"
    | "RECEIVED"
    | "CANCELLED";
  createdAt: string;
  tanggal?: string;
  approvedAt?: string;
  requester: { name: string };
  approver?: { name: string } | null;
  gudangId: string;
  gudang: { nama: string; id: string; kode?: string };
  keterangan?: string | null;
  catatanApproval?: string | null;
  prioritas?: string | null;
  purchaseOrder?: PurchaseOrderSummary | null;
  /** Kiriman barang untuk PO pengajuan ini, urut dari yang paling lama. */
  goodsReceipts?: GoodsReceiptSummary[];
  /** Catatan belanja yang menyentuh baris pengajuan ini, terlama dulu. */
  purchaseRecords?: PurchaseRecordSummary[];
  items: PurchaseRequestItem[];
  jasaItems?: PurchaseRequestJasaItem[];
}

export interface BarangGudang {
  id: string;
  barangId: string;
  gudangId: string;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  gudang?: { id: string; nama: string };
}

export interface RestockSetting {
  id: string;
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
}

export interface Barang {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  minStokDefault?: number;
  totalStock?: number;
  stockPerGudang?: BarangGudang[];
  barangGudang?: BarangGudang[];
}

export interface Jasa {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  supplierId?: string | null;
  hargaEstimasi: number;
  kategoriPph?: string | null;
  deskripsi?: string | null;
  status: string;
  supplier?: { id: string; name: string; code: string } | null;
}

export interface Gudang {
  id: string;
  nama: string;
}

export type RestockFormItemType = "BARANG" | "JASA";

export interface RestockFormItem {
  tipe: RestockFormItemType;
  barangId?: string;
  jasaId?: string;
  quantity: number;
  hargaPerUnit?: number;
  keterangan?: string | null;
}

export type RestockApprovalKeputusan = Exclude<
  RestockLineApprovalStatus,
  "PENDING"
>;

/** Keputusan yang sedang disusun approver untuk satu baris barang/jasa. */
export interface RestockApprovalLineDecision {
  keputusan: RestockApprovalKeputusan;
  /** Jumlah yang disetujui; 0 berarti input dikosongkan. */
  jumlah: number;
  /** Barang pengganti; selalu null untuk baris jasa. */
  barangIdPengganti: string | null;
  catatan: string;
}

/** Keputusan per baris, dikunci dengan id baris pengajuan (bukan barangId). */
export interface RestockApprovalDecisions {
  items: Record<string, RestockApprovalLineDecision>;
  jasaItems: Record<string, RestockApprovalLineDecision>;
}

export type RestockApprovalLineKind = keyof RestockApprovalDecisions;

interface RestockApprovalLinePayload {
  itemId: string;
  keputusan: RestockApprovalKeputusan;
  jumlah?: number;
  catatan?: string;
}

export interface RestockApproveBarangLinePayload extends RestockApprovalLinePayload {
  barangIdPengganti?: string;
}

/** Body PATCH /api/inventory/restock/requests/[id] untuk persetujuan. */
export interface RestockApprovePayload {
  action: "APPROVE";
  catatan?: string;
  items: RestockApproveBarangLinePayload[];
  jasaItems: RestockApprovalLinePayload[];
}

/** Body PATCH /api/inventory/restock/requests/[id] untuk penolakan. */
export interface RestockRejectPayload {
  action: "REJECT";
  catatan: string;
}
