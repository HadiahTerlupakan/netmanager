import { InventoryApiRepository } from "../repositories/InventoryApiRepository";
import {
  buildCalculatedOpnameResponse,
  buildOpnameReportResponse,
  buildRestockAlertsResponse,
  buildRestockPredictionSummary,
  buildStockBreakdownResponse,
  buildUsageAnalyticsResponse,
} from "./inventory-route.helpers";
import {
  INVENTORY_ACTIVITY_ACTIONS,
  INVENTORY_ACTIVITY_SUBJECTS,
  recordInventoryActivity,
} from "./inventory-activity-log";
import {
  bolehAksesGudang,
  lingkupSiteGudang,
  siteIdsSaringan,
} from "./lingkup-gudang";
import {
  IZIN_PEMBATAS_BARANG,
  IZIN_PEMBATAS_OPNAME,
  IZIN_PEMBATAS_RESTOCK,
} from "../domain/izin-pembatas-site";

const DEFAULT_RESTOCK_PAGE = 1;
const DEFAULT_RESTOCK_LIMIT = 20;
const DEFAULT_USAGE_DAYS = 30;

/** Pengguna yang sedang mengakses route inventory. */
export interface PenggunaInventory {
  userId: string;
  permissions: readonly string[];
  isSuperAdmin: boolean;
}

export interface ResolveLingkupSiteInput extends PenggunaInventory {
  /** Permission pembatas endpoint, mis. `IZIN_PEMBATAS_MASUK`. */
  restrictedPermissions: readonly string[];
}

export interface CanAccessGudangInput extends ResolveLingkupSiteInput {
  gudangId: string;
}

export class InventoryRouteService {
  constructor(private readonly repository = new InventoryApiRepository()) {}

  /**
   * Lingkup site pengguna untuk satu endpoint inventory (site utama + seluruh
   * `userSites`). Dibatasi tanpa site menghasilkan lingkup kosong, bukan
   * "tanpa batas".
   */
  async resolveLingkupSite(input: ResolveLingkupSiteInput) {
    return lingkupSiteGudang({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      izinPembatas: input.restrictedPermissions,
    });
  }

  /** Apakah pengguna boleh memakai gudang ini dalam lingkup endpoint-nya. */
  async canAccessGudang(input: CanAccessGudangInput) {
    return bolehAksesGudang({
      userId: input.userId,
      gudangId: input.gudangId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      izinPembatas: input.restrictedPermissions,
    });
  }

  /** Ambil statistik inventory untuk dashboard route, dibatasi site pengguna. */
  async getInventoryStats(input: {
    pengguna: PenggunaInventory;
    startOfDay: Date;
  }) {
    const lingkup = await this.resolveLingkupSite({
      ...input.pengguna,
      restrictedPermissions: IZIN_PEMBATAS_BARANG,
    });
    return this.repository.findInventoryStats({
      siteIds: siteIdsSaringan(lingkup),
      startOfDay: input.startOfDay,
    });
  }

  /** Ambil analitik penggunaan barang. */
  async getUsageAnalytics(input: {
    barangId: string;
    gudangId: string;
    days?: number;
  }) {
    const days = input.days || DEFAULT_USAGE_DAYS;
    const result = await this.repository.findUsageAnalytics({
      barangId: input.barangId,
      gudangId: input.gudangId,
      days,
    });

    return buildUsageAnalyticsResponse({
      barangId: input.barangId,
      gudangId: input.gudangId,
      days,
      usageData: result.usageData,
      currentStock: result.currentStock,
      monthlyUsage: result.monthlyUsage,
    });
  }

  /** Ambil daftar restock alert dengan pagination. */
  async getRestockAlerts(input: {
    barangId?: string;
    gudangId?: string;
    isRead?: boolean;
    isResolved?: boolean;
    urgency?: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page || DEFAULT_RESTOCK_PAGE;
    const limit = input.limit || DEFAULT_RESTOCK_LIMIT;
    const result = await this.repository.findRestockAlerts({
      ...input,
      page,
      limit,
    });

    return buildRestockAlertsResponse({
      page,
      limit,
      total: result.total,
      unreadCount: result.unreadCount,
      alerts: result.alerts,
    });
  }

  /** Jalankan auto check alert restock. */
  async autoCheckRestockAlerts() {
    const newAlerts = await this.repository.autoCheckRestockAlerts();
    return {
      message: `Auto check completed. Found ${newAlerts.length} new alerts.`,
      newAlerts,
    };
  }

  /** Ambil daftar pengaturan restock. */
  async getRestockSettings(input: {
    barangId?: string;
    gudangId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = input.page || DEFAULT_RESTOCK_PAGE;
    const limit = input.limit || DEFAULT_RESTOCK_LIMIT;
    const result = await this.repository.findRestockSettings({
      ...input,
      page,
      limit,
    });

    return {
      settings: result.settings,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  /** Simpan pengaturan restock. */
  async saveRestockSettings(input: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    safetyStok?: number;
    leadTimeDays?: number;
  }) {
    return this.repository.saveRestockSettings(input);
  }

  /** Ambil prediksi restock beserta ringkasannya. */
  async getRestockPredictions(input: { gudangId?: string; days?: number }) {
    const days = input.days || 90;
    const predictions = await this.repository.findRestockPredictions({
      gudangId: input.gudangId,
      days,
    });

    return {
      predictions,
      summary: buildRestockPredictionSummary(predictions),
      days,
    };
  }

  /**
   * Ambil daftar purchase request restock.
   *
   * `siteIds` diisi pemanggil saat role memegang `restock:site_only`; kosongkan
   * untuk melihat seluruh gudang.
   */
  async getPurchaseRequests(input: {
    tenantId: string;
    status?: string | null;
    siteIds?: string[];
  }) {
    const data = await this.repository.findPurchaseRequests(input);
    return { data };
  }

  /**
   * Apakah pengguna boleh membuka atau memproses pengajuan restock ini:
   * gudangnya harus di dalam lingkup `restock:site_only`, sama seperti
   * daftarnya. Pengajuan yang tidak ada dijawab `true` supaya pemanggil tetap
   * yang melaporkan 404 dengan pesannya sendiri.
   */
  async canAccessPurchaseRequest(
    input: PenggunaInventory & { id: string; tenantId: string },
  ) {
    const request = await this.repository.findPurchaseRequestById({
      id: input.id,
      tenantId: input.tenantId,
    });
    if (!request) return true;

    return this.canAccessGudang({
      userId: input.userId,
      permissions: input.permissions,
      isSuperAdmin: input.isSuperAdmin,
      gudangId: request.gudangId,
      restrictedPermissions: IZIN_PEMBATAS_RESTOCK,
    });
  }

  /**
   * Stok terkini di gudang tujuan pengajuan, per barang, untuk modal
   * persetujuan. Minimum diambil dari pengaturan restock aktif barang+gudang,
   * jika tidak ada dari `minStokDefault` barang (0 berarti tidak diatur).
   * Null bila pengajuan tidak ditemukan.
   */
  async getApprovalStock(input: { id: string; tenantId: string }) {
    const source = await this.repository.findApprovalStock(input);
    if (!source) return null;
    const minStokBySetting = new Map(
      source.settings.map((setting) => [setting.barangId, setting.minStok]),
    );
    return {
      gudangId: source.gudangId,
      gudangName: source.gudangName,
      items: source.stocks.map((stock) => {
        const minStok =
          minStokBySetting.get(stock.barangId) ??
          stock.barang?.minStokDefault ??
          0;
        return {
          barangId: stock.barangId,
          stok: stock.stok,
          stokBaru: stock.stokBaru,
          stokBekas: stock.stokBekas,
          stokRusak: stock.stokRusak,
          minStok: minStok > 0 ? minStok : null,
        };
      }),
    };
  }

  /** Ambil purchase request dengan validasi tenant. */
  async getPurchaseRequestById(input: { id: string; tenantId: string }) {
    return this.repository.findPurchaseRequestById(input);
  }

  /** Perbarui purchase request draft atau submitted dan catat pelakunya. */
  async updatePurchaseRequest(input: {
    id: string;
    tenantId: string;
    actorId: string;
    gudangId: string;
    keterangan?: string;
    items: Array<{
      barangId: string;
      quantity: number;
      keterangan?: string | null;
    }>;
    jasaItems?: Array<{
      jasaId: string;
      jumlah: number;
      hargaPerUnit?: number;
      keterangan?: string | null;
    }>;
  }) {
    const { actorId, ...payload } = input;
    const updated = await this.repository.updatePurchaseRequest(payload);
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.UPDATE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: updated?.nomorRequest ?? input.id,
      actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.id,
        gudangId: input.gudangId,
        jumlahBarang: input.items.length,
        jumlahJasa: input.jasaItems?.length ?? 0,
        keterangan: input.keterangan,
      },
    });
    return updated;
  }

  /** Hapus purchase request dan catat pelakunya. */
  async deletePurchaseRequest(input: {
    id: string;
    nomorRequest: string;
    purchaseOrderId?: string | null;
    actorId: string;
    tenantId: string;
  }) {
    const result = await this.repository.deletePurchaseRequest(input.id);
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.DELETE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: input.nomorRequest,
      actorId: input.actorId,
      tenantId: input.tenantId,
      details: {
        purchaseRequestId: input.id,
        purchaseOrderId: input.purchaseOrderId ?? null,
      },
    });
    return result;
  }

  /**
   * Pengajuan yang pesanannya sudah menerima barang tidak boleh dihapus,
   * karena barangnya sudah masuk gudang.
   */
  async hasPurchaseRequestArrivedGoods(
    purchaseOrderId: string | null | undefined,
  ): Promise<boolean> {
    if (!purchaseOrderId) return false;
    return this.repository.hasArrivedGoods(purchaseOrderId);
  }

  /**
   * Pengajuan yang barangnya sudah ada yang dibeli tidak boleh dihapus:
   * catatan belanja (uang yang sudah keluar) akan ikut terhapus.
   */
  async hasPurchaseRequestPurchases(
    purchaseOrderId: string | null | undefined,
  ): Promise<boolean> {
    if (!purchaseOrderId) return false;
    return this.repository.hasPurchaseRecords(purchaseOrderId);
  }

  /** Ambil summary opname inventory, dibatasi site pengguna. */
  async getOpnameSummary(input: {
    pengguna: PenggunaInventory;
    gudangId?: string;
  }) {
    const siteIds = await this.resolveOpnameSiteIds(input.pengguna);
    return this.repository.findOpnameSummary({
      gudangId: input.gudangId,
      siteIds,
    });
  }

  /** Ambil laporan opname inventory, dibatasi site pengguna. */
  async getOpnameReport(input: {
    pengguna: PenggunaInventory;
    gudangId?: string;
  }) {
    const siteIds = await this.resolveOpnameSiteIds(input.pengguna);
    const gudangList = await this.repository.findOpnameReport({
      gudangId: input.gudangId,
      siteIds,
    });
    return buildOpnameReportResponse(gudangList);
  }

  /** Hitung data awal opname untuk gudang. */
  async calculateOpname(gudangId: string) {
    const items = await this.repository.calculateOpname(gudangId);
    return buildCalculatedOpnameResponse(items);
  }

  private async resolveOpnameSiteIds(pengguna: PenggunaInventory) {
    const lingkup = await this.resolveLingkupSite({
      ...pengguna,
      restrictedPermissions: IZIN_PEMBATAS_OPNAME,
    });
    return siteIdsSaringan(lingkup);
  }

  /** Ambil stok barang saat ini. */
  async getStockInfo(barangId: string, gudangId: string) {
    const stock = await this.repository.findStockInfo(barangId, gudangId);
    return {
      stok: stock?.stok || 0,
      barang: stock?.barang,
      gudang: stock?.gudang,
    };
  }

  /** Ambil stok per kondisi. */
  async getStockBreakdown(barangId: string, gudangId: string) {
    const { stockSnapshot, barangInfo, gudangInfo } =
      await this.repository.findStockBreakdown(barangId, gudangId);

    return buildStockBreakdownResponse({
      stockSnapshot,
      barangInfo,
      gudangInfo,
    });
  }

  /** Ambil record keluar dan validasi site oleh caller. */
  async getKeluarRecordWithSite(id: string) {
    return this.repository.findKeluarRecordWithSite(id);
  }

  /** Perbarui record barang keluar. */
  async updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }) {
    return this.repository.updateKeluarRecord(input);
  }

  /** Hapus record barang keluar. */
  async deleteKeluarRecord(id: string) {
    return this.repository.deleteKeluarRecord(id);
  }

  /** Verifikasi transaksi inventory untuk upload foto. */
  async verifyInventoryTransaction(input: {
    transactionId: string;
    transactionType: string;
  }) {
    return this.repository.verifyInventoryTransaction(input);
  }
}

let inventoryRouteServiceInstance: InventoryRouteService | null = null;

/** Ambil singleton service untuk route inventory tipis. */
export function getInventoryRouteService() {
  if (!inventoryRouteServiceInstance) {
    inventoryRouteServiceInstance = new InventoryRouteService();
  }

  return inventoryRouteServiceInstance;
}
