import type { KondisiBarang } from "../types/asset.enums";
import type { InventoryActorInput } from "../domain/ports/IInventoryOperationRepository";

export class MobileInventoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface MobileGudangItem {
  id: string;
  kode: string;
  nama: string;
  lokasi: string | null;
}

export interface MobileActorLookupInput {
  actorId: string;
  tenantId: string;
}

export interface MobileSiteScopedInput {
  tenantId: string;
  siteIds?: string[];
}

export interface MobileBarangKeluarLookupInput extends MobileSiteScopedInput {
  gudangId: string;
}

export interface MobileGudangLookupInput {
  gudangId: string;
  tenantId: string;
}

export interface MobileBarangGudangStockInput extends MobileGudangLookupInput {
  barangId: string;
}

export interface MobileActorUser {
  id: string;
  role?: {
    name?: string | null;
    permission?: Array<{ resource: string; action: string }>;
  } | null;
  sites?: { id: string } | null;
  userSites?: Array<{ siteId: string }> | null;
}

export interface MobileActorMitra {
  id: string;
  siteId?: string | null;
}

export interface MobileGudangSites {
  id: string;
  sites: Array<{ id: string }>;
}

export interface MobileBarangMaster {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial: boolean;
}

export interface MobileBarangStock {
  barang: MobileBarangMaster;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
}

export interface MobileBarangGudangStock {
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  barang?: { nama: string } | null;
}

export interface MobileHistoryRecord {
  id: string;
  barang: { kode: string; nama: string; satuan: string };
  gudang: { nama: string };
  jumlah: number;
  kondisi: string | null;
  keterangan: string | null;
  tanggal: Date;
}

export interface MobileHistoryItem extends Omit<
  MobileHistoryRecord,
  "tanggal"
> {
  type: "masuk" | "keluar";
  tanggal: string;
  rawDate?: Date;
}

export interface MobileAddStockInput {
  barangId: string;
  gudangId: string;
  jumlah: number;
  kondisi?: KondisiBarang;
  keterangan?: string;
  supplier?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown> | null;
  actor?: InventoryActorInput;
  tanggal?: Date;
  tenantId?: string;
}

export interface MobileRemoveStockInput extends Omit<
  MobileAddStockInput,
  "supplier"
> {
  kondisi: KondisiBarang;
  tujuanPenggunaan?: string;
}

export interface MobileCommandInput {
  actorId: string;
  tenantId: string;
  barangId: string;
  gudangId: string;
  jumlah: unknown;
  kondisi?: KondisiBarang;
  keterangan?: string;
  supplier?: string;
  tujuanPenggunaan?: string;
  fotoBukti?: string[];
  fotoMetadata?: Record<string, unknown> | null;
}

export interface MobileHistoryLookupInput {
  tenantId: string;
  where: Record<string, unknown>;
  take: number;
}

export interface MobileInventoryRepository {
  findMobileActorUser(
    input: MobileActorLookupInput,
  ): Promise<MobileActorUser | null>;
  findMobileActorMitra(actorId: string): Promise<MobileActorMitra | null>;
  findMobileGudangs(input: MobileSiteScopedInput): Promise<MobileGudangItem[]>;
  findMobileBarangForMasuk(
    input: MobileSiteScopedInput,
  ): Promise<MobileBarangMaster[]>;
  findMobileBarangForKeluar(
    input: MobileBarangKeluarLookupInput,
  ): Promise<MobileBarangStock[]>;
  findMobileGudangSites(
    input: MobileGudangLookupInput,
  ): Promise<MobileGudangSites | null>;
  findMobileBarangGudangStock(
    input: MobileBarangGudangStockInput,
  ): Promise<MobileBarangGudangStock | null>;
  findMobileHistoryMasuk(
    input: MobileHistoryLookupInput,
  ): Promise<MobileHistoryRecord[]>;
  findMobileHistoryKeluar(
    input: MobileHistoryLookupInput,
  ): Promise<MobileHistoryRecord[]>;
  addStock(input: MobileAddStockInput): Promise<unknown>;
  removeStock(input: MobileRemoveStockInput): Promise<unknown>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
}

export interface MobileScopeResult {
  actor: InventoryActorInput;
  isRestricted: boolean;
  allowedSiteIds: string[];
}
