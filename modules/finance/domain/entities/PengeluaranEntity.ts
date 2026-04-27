export interface FinanceAuditUserEntity {
  id: string;
  name?: string;
  email?: string;
}

/** Pure domain entity for finance pengeluaran. */
export interface PengeluaranEntity {
  id: string;
  nomorBukti?: string;
  tanggal: Date;
  tipePengeluaran?: "CAPEX" | "OPEX";
  kategori: string;
  deskripsi: string;
  jumlah: string;
  metodeBayar?: string;
  catatan?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  createdByUser?: FinanceAuditUserEntity;
  updatedByUser?: FinanceAuditUserEntity;
}
