export interface PurchaseRequestItemEntity {
  id: string;
  barangId: string;
  jumlah: number;
  hargaPerUnit: number;
  totalHarga: number;
  tenantId: string | null;
  barang: PurchaseRequestItemBarangEntity;
}

export interface PurchaseRequestItemBarangEntity {
  id: string;
  nama: string;
  supplierId: string | null;
}

export interface PurchaseRequestJasaItemEntity {
  id: string;
  jasaId: string;
  jumlah: number;
  hargaPerUnit: number;
  totalHarga: number;
  tenantId: string | null;
  jasa: {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    supplierId: string | null;
  };
}

export interface PurchaseRequestEntity {
  id: string;
  tenantId: string | null;
  status: string;
  purchaseOrderId: string | null;
  items: PurchaseRequestItemEntity[];
  jasaItems: PurchaseRequestJasaItemEntity[];
}

export interface PurchaseRequestSummaryEntity {
  id: string;
  nomorRequest: string;
  status: string;
  prioritas: string;
  tanggal: Date;
  approvedAt: Date | null;
  purchaseOrderId: string | null;
  tenantId: string | null;
  requesterName: string | null;
  gudangNama: string | null;
  totalItems: number;
  totalNilai: number;
}
