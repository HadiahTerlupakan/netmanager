import type {
  Gudang,
  Barang,
  BarangMasuk,
  BarangKeluar,
  Prisma,
} from "@prisma/client";

export type {
  BarangWithStock,
  BarangMasukWithRelations,
  BarangKeluarWithRelations,
  InventoryActorInput,
  FindInventoryBarangParams,
  CreateInventoryBarangData,
  CreateBarangInput,
  UpdateBarangInput,
  CreateBarangMasukInput,
  CreateBarangKeluarInput,
  BarangDetail,
  CreateGudangInput,
  UpdateGudangInput,
  CreateTransferInput,
  UpdateTransferInput,
  InventoryTransferWarehouseSnapshot,
  InventoryTransferBarangSnapshot,
  InventoryTransferHistorySnapshot,
  InventoryTransferRecord,
  UpdateBarangMasukInput,
  UpdateStockOpnameInput,
  InventoryRecordSite,
  InventoryMasukRecord,
  InventoryOpnameRecord,
  UpdatedStockOpnameResult,
  MobileGudangRecord,
  MobileActorUserRecord,
  MobileActorMitraRecord,
} from "./IInventoryOperationRepository.types";

import type {
  BarangWithStock,
  BarangDetail,
  CreateBarangInput,
  UpdateBarangInput,
  CreateBarangMasukInput,
  CreateBarangKeluarInput,
  BarangMasukWithRelations,
  BarangKeluarWithRelations,
  CreateGudangInput,
  UpdateGudangInput,
  CreateTransferInput,
  UpdateTransferInput,
  InventoryTransferRecord,
  UpdateBarangMasukInput,
  InventoryMasukRecord,
  InventoryOpnameRecord,
  UpdateStockOpnameInput,
  UpdatedStockOpnameResult,
  MobileActorUserRecord,
  MobileActorMitraRecord,
  MobileGudangRecord,
} from "./IInventoryOperationRepository.types";

export interface IInventoryOperationRepository {
  findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
  }): Promise<{ items: InventoryTransferRecord[]; total: number }>;
  findTransferById(id: string): Promise<InventoryTransferRecord | null>;
  createTransfer(data: CreateTransferInput): Promise<InventoryTransferRecord>;
  updateTransfer(
    id: string,
    data: UpdateTransferInput,
  ): Promise<InventoryTransferRecord>;
  deleteTransfer(id: string): Promise<void>;
  findGudangById(id: string): Promise<Gudang | null>;
  findGudangByKode(kode: string): Promise<Gudang | null>;
  createGudang(data: CreateGudangInput): Promise<Gudang>;
  updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang>;
  deleteGudang(id: string): Promise<void>;
  hasStockInGudang(id: string): Promise<boolean>;
  findAllBarang(params?: {
    skip?: number;
    take?: number;
    search?: string;
    gudangId?: string;
    isWorkOrderMaterial?: boolean;
    siteId?: string;
  }): Promise<{ items: BarangWithStock[]; total: number }>;
  findBarangById(id: string): Promise<BarangWithStock | null>;
  findBarangDetail(id: string): Promise<BarangDetail | null>;
  findBarangByKode(kode: string): Promise<BarangWithStock | null>;
  existsBarangByKode(kode: string): Promise<boolean>;
  createBarang(data: CreateBarangInput): Promise<Barang>;
  updateBarang(id: string, data: UpdateBarangInput): Promise<Barang>;
  deleteBarang(id: string): Promise<void>;
  addStock(data: CreateBarangMasukInput): Promise<BarangMasuk>;
  addStockInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateBarangMasukInput,
  ): Promise<BarangMasuk>;
  removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar>;
  getStockLevel(barangId: string, gudangId: string): Promise<number>;
  getAllGudang(params?: { siteId?: string }): Promise<Gudang[]>;
  findMobileActorUser(input: {
    actorId: string;
    tenantId: string;
  }): Promise<MobileActorUserRecord | null>;
  findMobileActorMitra(actorId: string): Promise<MobileActorMitraRecord | null>;
  findMobileGudangs(input: {
    tenantId: string;
    siteIds?: string[];
  }): Promise<MobileGudangRecord[]>;
  getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }>;
  getHistoryMasuk(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
  }): Promise<{ items: BarangMasukWithRelations[]; total: number }>;
  getHistoryKeluar(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
  }): Promise<{ items: BarangKeluarWithRelations[]; total: number }>;
  getMasukRecord(id: string): Promise<InventoryMasukRecord | null>;
  updateMasuk(input: UpdateBarangMasukInput): Promise<void>;
  deleteMasuk(id: string): Promise<void>;
  getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null>;
  updateOpname(
    input: UpdateStockOpnameInput,
  ): Promise<UpdatedStockOpnameResult>;
  deleteOpname(id: string): Promise<void>;
}
