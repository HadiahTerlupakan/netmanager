export interface InventoryGudangEntity {
  id: string;
  kode: string;
  nama: string;
}

export interface InventoryStockEntity {
  id: string;
  gudangId: string;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  gudang: InventoryGudangEntity;
}

export interface InventoryBarangEntity {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial: boolean;
  jenis: string | null;
  kategoriAset: string | null;
  minStokDefault: number;
  createdAt: Date;
  updatedAt: Date;
  barangGudang: InventoryStockEntity[];
}

export interface InventoryBarangListEntity {
  items: InventoryBarangEntity[];
  total: number;
}
