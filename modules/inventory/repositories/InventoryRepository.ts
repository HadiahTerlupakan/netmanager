import { PrismaClient, Prisma } from "@prisma/client";
import type { Barang, BarangMasuk, BarangKeluar, Gudang } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  UpdateBarangInput,
  CreateBarangMasukInput,
  CreateBarangKeluarInput,
  BarangWithStock,
  BarangMasukWithRelations,
  BarangKeluarWithRelations,
  CreateGudangInput,
  UpdateGudangInput,
  CreateTransferInput,
  UpdateTransferInput,
  BarangDetail,
  UpdateBarangMasukInput,
  UpdateStockOpnameInput,
  InventoryMasukRecord,
  InventoryOpnameRecord,
  InventoryTransferRecord,
  UpdatedStockOpnameResult,
} from "../domain/ports/IInventoryOperationRepository";
import type { IInventoryOperationRepository } from "../domain/ports/IInventoryOperationRepository";
import type {
  IInventoryRepository as IInventoryDomainRepository,
  FindInventoryBarangParams,
  CreateInventoryBarangData,
} from "../domain/ports/IInventoryRepository";
import {
  createInventoryBarang,
  deleteInventoryBarang,
  findAllInventoryBarang,
  findBarangWithStockById,
  findBarangWithStockByKode,
  findInventoryBarangDetail,
  updateInventoryBarang,
} from "./inventory-repository-core-helpers";
import { InventoryGudangRepository } from "./InventoryGudangRepository";
import { InventoryRestockAlertRepository } from "./InventoryRestockAlertRepository";
import { InventoryMobileRepository } from "./InventoryMobileRepository";
import { InventoryOpnameRepository } from "./InventoryOpnameRepository";
import { InventoryStockQueryRepository } from "./InventoryStockQueryRepository";
import { InventoryTransferRepository } from "./InventoryTransferRepository";
import type { RestockSettingRecord } from "./inventory-repository.contracts";
import {
  getHistoryKeluar,
  getHistoryMasuk,
} from "./inventory-repository-history-helpers";
import {
  deleteMasuk,
  getMasukRecord,
  updateMasuk,
} from "./inventory-repository-masuk-helpers";
import { addInventoryStockInTransaction } from "./inventory-repository-stock-in-helpers";
import { removeInventoryStock } from "./inventory-stock-out-helpers";

export class InventoryRepository
  implements
    IInventoryDomainRepository,
    Omit<IInventoryOperationRepository, "findAllBarang" | "createBarang">
{
  private db: PrismaClient;
  private gudangRepository: InventoryGudangRepository;
  private mobileRepository: InventoryMobileRepository;
  private opnameRepository: InventoryOpnameRepository;
  private restockAlertRepository: InventoryRestockAlertRepository;
  private stockQueryRepository: InventoryStockQueryRepository;
  private transferRepository: InventoryTransferRepository;

  constructor() {
    this.db = prisma;
    this.gudangRepository = new InventoryGudangRepository(this.db);
    this.mobileRepository = new InventoryMobileRepository(this.db);
    this.opnameRepository = new InventoryOpnameRepository(this.db);
    this.restockAlertRepository = new InventoryRestockAlertRepository(this.db);
    this.stockQueryRepository = new InventoryStockQueryRepository(this.db);
    this.transferRepository = new InventoryTransferRepository(this.db);
  }
  async findActiveRestockSettings(): Promise<RestockSettingRecord[]> {
    return this.restockAlertRepository.findActiveRestockSettings();
  }
  async findRestockNotificationRecipients() {
    return this.restockAlertRepository.findRestockNotificationRecipients();
  }
  async findBarangGudangStock(barangId: string, gudangId: string) {
    return this.restockAlertRepository.findBarangGudangStock(
      barangId,
      gudangId,
    );
  }
  async findOpenRestockAlert(input: {
    barangId: string;
    gudangId: string;
    alertType: import("@prisma/client").AlertType;
  }) {
    return this.restockAlertRepository.findOpenRestockAlert(input);
  }
  async createRestockAlert(data: Prisma.RestockAlertsUncheckedCreateInput) {
    return this.restockAlertRepository.createRestockAlert(data);
  }
  async createNotifications(data: Prisma.NotificationsCreateManyInput[]) {
    return this.restockAlertRepository.createNotifications(data);
  }
  async findAllBarang(params?: FindInventoryBarangParams): Promise<{
    items: import("../domain/entities/InventoryEntity").InventoryBarangEntity[];
    total: number;
  }> {
    return findAllInventoryBarang(this.db, params);
  }
  async findBarangById(id: string): Promise<BarangWithStock | null> {
    return findBarangWithStockById(this.db, id);
  }
  async findBarangByKode(kode: string): Promise<BarangWithStock | null> {
    return findBarangWithStockByKode(this.db, kode);
  }
  async existsBarangByKode(kode: string): Promise<boolean> {
    const count = await this.db.barang.count({ where: { kode } });
    return count > 0;
  }
  async createBarang(data: CreateInventoryBarangData) {
    return createInventoryBarang(this.db, data);
  }
  async updateBarang(id: string, data: UpdateBarangInput): Promise<Barang> {
    return updateInventoryBarang(this.db, id, data);
  }
  async findBarangDetail(id: string): Promise<BarangDetail | null> {
    return findInventoryBarangDetail(this.db, id);
  }
  async deleteBarang(id: string): Promise<void> {
    await deleteInventoryBarang(this.db, id);
  }
  async addStock(data: CreateBarangMasukInput): Promise<BarangMasuk> {
    return this.db.$transaction(async (tx) =>
      this.addStockInTransaction(tx, data),
    );
  }
  async addStockInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateBarangMasukInput,
  ): Promise<BarangMasuk> {
    return addInventoryStockInTransaction(tx, data);
  }
  async removeStock(data: CreateBarangKeluarInput): Promise<BarangKeluar> {
    return this.db.$transaction((tx) => removeInventoryStock({ tx, data }));
  }
  async getStockLevel(barangId: string, gudangId: string): Promise<number> {
    return this.stockQueryRepository.getStockLevel(barangId, gudangId);
  }
  async getAllGudang(params?: {
    siteId?: string;
    tenantId?: string;
  }): Promise<Gudang[]> {
    return this.stockQueryRepository.getAllGudang(params);
  }
  async findMobileActorUser(input: { actorId: string; tenantId: string }) {
    return this.mobileRepository.findMobileActorUser(input);
  }
  async findMobileActorMitra(actorId: string) {
    return this.mobileRepository.findMobileActorMitra(actorId);
  }
  async findMobileGudangs(input: { tenantId: string; siteIds?: string[] }) {
    return this.mobileRepository.findMobileGudangs(input);
  }
  async findMobileBarangForMasuk(input: {
    tenantId: string;
    siteIds?: string[];
  }) {
    return this.mobileRepository.findMobileBarangForMasuk(input);
  }
  async findMobileBarangForKeluar(input: {
    tenantId: string;
    gudangId: string;
    siteIds?: string[];
  }) {
    return this.mobileRepository.findMobileBarangForKeluar(input);
  }
  async findMobileGudangSites(input: { gudangId: string; tenantId: string }) {
    return this.mobileRepository.findMobileGudangSites(input);
  }
  async findMobileBarangGudangStock(input: {
    barangId: string;
    gudangId: string;
    tenantId: string;
  }) {
    return this.mobileRepository.findMobileBarangGudangStock(input);
  }
  async findMobileHistoryMasuk(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.mobileRepository.findMobileHistoryMasuk(input);
  }
  async findMobileHistoryKeluar(input: {
    where: Record<string, unknown>;
    take: number;
  }) {
    return this.mobileRepository.findMobileHistoryKeluar(input);
  }
  async findGudangById(id: string): Promise<Gudang | null> {
    return this.gudangRepository.findGudangById(id);
  }
  async findGudangByKode(kode: string): Promise<Gudang | null> {
    return this.gudangRepository.findGudangByKode(kode);
  }
  async createGudang(data: CreateGudangInput): Promise<Gudang> {
    return this.gudangRepository.createGudang(data);
  }
  async updateGudang(id: string, data: UpdateGudangInput): Promise<Gudang> {
    return this.gudangRepository.updateGudang(id, data);
  }
  async deleteGudang(id: string): Promise<void> {
    await this.gudangRepository.deleteGudang(id);
  }
  async hasStockInGudang(id: string): Promise<boolean> {
    return this.gudangRepository.hasStockInGudang(id);
  }
  async findAllTransfers(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    dariGudangId?: string;
    keGudangId?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: InventoryTransferRecord[]; total: number }> {
    return this.transferRepository.findAllTransfers(params);
  }
  async findTransferById(id: string): Promise<InventoryTransferRecord | null> {
    return this.transferRepository.findTransferById(id);
  }
  async createTransfer(
    data: CreateTransferInput,
  ): Promise<InventoryTransferRecord> {
    return this.transferRepository.createTransfer(data);
  }
  async updateTransfer(
    id: string,
    data: UpdateTransferInput,
  ): Promise<InventoryTransferRecord> {
    return this.transferRepository.updateTransfer(id, data);
  }
  async deleteTransfer(id: string): Promise<void> {
    await this.transferRepository.deleteTransfer(id);
  }
  async getStockBreakdown(
    barangId: string,
    gudangId: string,
  ): Promise<{ baru: number; bekas: number; rusak: number; total: number }> {
    return this.stockQueryRepository.getStockBreakdown(barangId, gudangId);
  }
  async getHistoryMasuk(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: BarangMasukWithRelations[]; total: number }> {
    return getHistoryMasuk(this.db, params);
  }
  async getHistoryKeluar(params?: {
    skip?: number;
    take?: number;
    barangId?: string;
    gudangId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    siteId?: string;
    tenantId?: string;
  }): Promise<{ items: BarangKeluarWithRelations[]; total: number }> {
    return getHistoryKeluar(this.db, params);
  }
  async getMasukRecord(id: string): Promise<InventoryMasukRecord | null> {
    return getMasukRecord(this.db, id);
  }
  async updateMasuk(input: UpdateBarangMasukInput): Promise<void> {
    await updateMasuk(this.db, input);
  }
  async deleteMasuk(id: string): Promise<void> {
    await deleteMasuk(this.db, id);
  }
  async getOpnameRecord(id: string): Promise<InventoryOpnameRecord | null> {
    return this.opnameRepository.getOpnameRecord(id);
  }
  async updateOpname(
    input: UpdateStockOpnameInput,
  ): Promise<UpdatedStockOpnameResult> {
    return this.opnameRepository.updateOpname(input);
  }
  async deleteOpname(id: string): Promise<void> {
    await this.opnameRepository.deleteOpname(id);
  }
}
