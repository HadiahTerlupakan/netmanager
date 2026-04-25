export interface PurchaseRequestItem {
  id: string;
  barangId: string;
  jumlah: number;
  receivedQuantity: number;
  keterangan?: string | null;
  barang: { nama: string; kode: string; satuan: string };
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

export interface Gudang {
  id: string;
  nama: string;
}

export interface RestockFormItem {
  barangId: string;
  quantity: number;
  keterangan?: string | null;
}
