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
  /**
   * Jumlah di item PO; berbeda dari `jumlah` bila pesanannya diubah atau
   * menggabungkan beberapa pengajuan.
   */
  orderedQuantity?: number;
  receivedQuantity: number;
  cancelledQuantity?: number;
  cancelReason?: string | null;
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

/** Map barangId asli (di pengajuan) → barangId pengganti yang benar-benar masuk. */
export type RestockSubstitutionMap = Record<string, string>;

/** barangId → alasan barang masuk melebihi sisa pesanan. */
export type RestockOverReceiptMap = Record<string, string>;

/** Satu barang di satu catatan barang masuk (GRN). */
export interface GoodsReceiptLineSummary {
  barangId: string;
  /** null bila data barangnya sudah tidak ada. */
  nama: string | null;
  satuan: string | null;
  quantity: number;
}

/** Satu catatan barang masuk ke gudang. */
export interface GoodsReceiptSummary {
  id: string;
  grnNumber: string;
  fotoBukti: string[];
  receivedAt?: string | null;
  receivedBy?: { name: string } | null;
  items?: GoodsReceiptLineSummary[];
}

/** Pesanan yang dibuat otomatis saat pengajuan disetujui. */
export interface PurchaseOrderSummary {
  id?: string | null;
  poNumber?: string | null;
  status?: string | null;
  /**
   * Jumlah pengajuan yang memakai pesanan ini; lebih dari satu berarti
   * pesanan gabungan. Kosong dibaca sebagai pesanan milik satu pengajuan.
   */
  linkedRequestCount?: number;
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
  /** Alasan admin membatalkan pengajuan yang sudah disetujui. */
  cancelReason?: string | null;
  prioritas?: string | null;
  purchaseOrderId?: string | null;
  purchaseOrder?: PurchaseOrderSummary | null;
  /** Catatan barang masuk pengajuan ini, urut dari yang paling lama. */
  goodsReceipts?: GoodsReceiptSummary[];
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
