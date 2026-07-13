export interface PurchaseRequestItem {
  id: string;
  barangId: string;
  jumlah: number;
  receivedQuantity: number;
  keterangan?: string | null;
  barang: { nama: string; kode: string; satuan: string };
}

export interface PurchaseRequestJasaItem {
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

export interface PurchaseOrderSummary {
  poNumber?: string | null;
  status?: string | null;
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
  approver?: { name: string };
  gudangId: string;
  gudang: { nama: string; id: string; kode?: string };
  keterangan?: string | null;
  catatanApproval?: string | null;
  prioritas?: string | null;
  purchaseOrder?: PurchaseOrderSummary | null;
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
