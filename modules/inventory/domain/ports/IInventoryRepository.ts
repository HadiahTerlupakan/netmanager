import type {
  InventoryBarangEntity,
  InventoryBarangListEntity,
} from "../entities/InventoryEntity";

export interface CreateInventoryBarangData {
  kode: string;
  nama: string;
  satuan: string;
  isWorkOrderMaterial?: boolean;
  jenis?: string;
  kategoriAset?: string;
  minStokDefault?: number;
}

export interface FindInventoryBarangParams {
  skip?: number;
  take?: number;
  search?: string;
  gudangId?: string;
  siteId?: string;
  tenantId?: string;
}

export interface IInventoryRepository {
  /** Check whether a barang code already exists. */
  existsBarangByKode(kode: string): Promise<boolean>;

  /** Create a new barang and return the domain entity. */
  createBarang(data: CreateInventoryBarangData): Promise<InventoryBarangEntity>;

  /** Get paginated barang data with stock relations. */
  findAllBarang(
    params?: FindInventoryBarangParams,
  ): Promise<InventoryBarangListEntity>;
}
