import type {
  Barang,
  BarangGudang,
  BarangKeluar,
  BarangMasuk,
  Gudang,
  KondisiBarang,
  JenisBarang,
  KategoriAset,
} from "@prisma/client";

export type BarangWithStock = Barang & {
  barangGudang: (BarangGudang & { gudang: Gudang })[];
};

export type BarangMasukWithRelations = BarangMasuk & {
  barang: Barang;
  gudang: Gudang;
  user?: { id: string; name: string | null } | null;
};

export type BarangKeluarWithRelations = BarangKeluar & {
  barang: Barang;
  gudang: Gudang;
  user?: { id: string; name: string | null } | null;
};

export interface InventoryActorInput {
  type: "user" | "mitra";
  id: string;
  userId?: string;
}

export interface FindInventoryBarangParams {
  skip?: number;
  take?: number;
  search?: string;
  gudangId?: string;
  siteId?: string;
  tenantId?: string;
}

export interface CreateInventoryBarangData {
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial?: boolean;
  jenis?: string;
  kategoriAset?: string;
  minStokDefault?: number;
}

export interface CreateBarangInput {
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial?: boolean;
  jenis?: JenisBarang;
  kategoriAset?: KategoriAset;
  minStokDefault?: number;
  tenantId?: string;
}

export interface UpdateBarangInput {
  kode?: string;
  nama?: string;
  satuan?: string;
  isWorkOrderMaterial?: boolean;
  jenis?: JenisBarang;
  kategoriAset?: KategoriAset;
  minStokDefault?: number;
  tenantId?: string;
}

export interface CreateBarangMasukInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  hargaBeliSatuan?: number;
  kondisi?: KondisiBarang;
  keterangan?: string;
  supplier?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown>;
  actor?: InventoryActorInput;
  userId?: string;
  tanggal?: Date;
  tenantId?: string;
}

export interface CreateBarangKeluarInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi: KondisiBarang;
  keterangan?: string;
  tujuanPenggunaan?: string;
  isHilang?: boolean;
  actor?: InventoryActorInput;
  userId?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown>;
  tanggal?: Date;
  tenantId?: string;
}

export type BarangDetail = BarangWithStock & {
  masuk: BarangMasukWithRelations[];
  keluar: BarangKeluarWithRelations[];
  opname: Record<string, unknown>[];
};

export interface CreateGudangInput {
  kode: string;
  nama: string;
  lokasi?: string | null;
  isActive?: boolean;
  siteIds?: string[];
  tenantId?: string;
}

export interface UpdateGudangInput {
  kode?: string;
  nama?: string;
  lokasi?: string | null;
  isActive?: boolean;
  tenantId?: string;
}

export interface CreateTransferInput {
  barangId: string;
  dariGudangId: string;
  keGudangId: string;
  jumlah: number;
  kondisi?: KondisiBarang;
  keterangan?: string;
  userId: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown>;
  tenantId?: string;
}

export interface UpdateTransferInput {
  keterangan?: string;
}

export interface InventoryTransferWarehouseSnapshot {
  id: string;
  kode: string;
  nama: string;
  lokasi?: string | null;
}

export interface InventoryTransferBarangSnapshot {
  id: string;
  kode: string;
  nama: string;
  satuan?: string;
}

export interface InventoryTransferHistorySnapshot {
  id: string;
  tanggal: Date;
  jumlah: number;
  kondisi: string;
  keterangan: string | null;
}

export interface InventoryTransferRecord {
  id: string;
  kodeTransfer: string;
  barangId: string;
  dariGudangId: string;
  keGudangId: string;
  tanggal: Date;
  jumlah: number;
  kondisi: string;
  keterangan: string | null;
  createdAt: Date;
  fotoBukti: string[];
  fotoMetadata?: Record<string, unknown> | null;
  createdById: string | null;
  tenantId: string | null;
  barang?: InventoryTransferBarangSnapshot;
  gudangDari?: InventoryTransferWarehouseSnapshot;
  gudangKe?: InventoryTransferWarehouseSnapshot;
  dariGudang?: InventoryTransferWarehouseSnapshot;
  keGudang?: InventoryTransferWarehouseSnapshot;
  createdBy?: { id: string; name: string | null; email?: string | null } | null;
  barangMasuk?: InventoryTransferHistorySnapshot[];
  barangKeluar?: InventoryTransferHistorySnapshot[];
  masuk?: InventoryTransferHistorySnapshot | null;
  keluar?: InventoryTransferHistorySnapshot | null;
}

export interface UpdateBarangMasukInput {
  id: string;
  jumlah: number;
  kondisi?: string | null;
  keterangan?: string | null;
}

export interface UpdateStockOpnameInput {
  id: string;
  stokFisik: number;
  keterangan?: string | null;
  kondisiBaik?: number;
  kondisiRusak?: number;
  kondisiExpire?: number;
  lokasiPenyimpanan?: string | null;
  nomorRak?: string | null;
  nomorBox?: string | null;
  pic?: string | null;
  suhuPenyimpanan?: string | null;
  kelembaban?: string | null;
  tanggalExpire?: string | null;
  nomorBatch?: string | null;
  catatanDetail?: string | null;
}

export interface InventoryRecordSite {
  id: string;
}

export interface InventoryMasukRecord {
  id: string;
  gudang: {
    id: string;
    kode: string;
    nama: string;
    sites?: InventoryRecordSite[];
  };
  barang: { id: string; kode: string; nama: string; satuan: string };
}

export interface InventoryOpnameRecord {
  id: string;
  gudang: { id: string; kode: string; nama: string; lokasi: string | null };
  barang: { id: string; kode: string; nama: string; satuan: string };
}

export interface UpdatedStockOpnameResult {
  record: Record<string, unknown>;
  stokSistem: number;
  selisih: number;
}

export interface MobileGudangRecord {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
}

export interface MobileActorUserRecord {
  id: string;
  role?: {
    name?: string | null;
    permission?: Array<{ resource: string; action: string }>;
  } | null;
  sites?: { id: string } | null;
  userSites?: Array<{ siteId: string }> | null;
}

export interface MobileActorMitraRecord {
  id: string;
  siteId?: string | null;
}
