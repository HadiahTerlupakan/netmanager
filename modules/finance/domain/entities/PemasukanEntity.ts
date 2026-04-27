export interface FinanceUserSummaryEntity {
  id: string;
  name?: string;
  email?: string;
}

/** Pure domain entity for finance pemasukan. */
export interface PemasukanEntity {
  id: string;
  nomorBukti?: string;
  tanggal: Date;
  kategori: string;
  deskripsi: string;
  jumlah: string;
  metodeBayar?: string;
  catatan?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  createdByUser?: FinanceUserSummaryEntity;
  updatedByUser?: FinanceUserSummaryEntity;
}
