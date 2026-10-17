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

const DEFAULT_RESTOCK_PAGE = 1;
const DEFAULT_RESTOCK_LIMIT = 20;
const DEFAULT_USAGE_DAYS = 30;

interface ResolveRestrictedSiteIdInput {
  userId: string;
  permissions: string[];
  isSuperAdmin: boolean;
  restrictedPermissions: string[];
}

export class InventoryRouteService {
  constructor(private readonly repository = new InventoryApiRepository()) {}

  /** Ambil siteId user untuk pembatasan akses route. */
  async getUserSiteId(userId: string) {
    return this.repository.findUserSiteId(userId);
  }

  /** Selesaikan siteId ketika permission route dibatasi site. */
  async resolveRestrictedSiteId(input: ResolveRestrictedSiteIdInput) {
    if (input.isSuperAdmin) return undefined;
    if (!this.hasRestrictedPermission(input)) return undefined;

    return this.getUserSiteId(input.userId);
  }

  private hasRestrictedPermission(input: ResolveRestrictedSiteIdInput) {
    return input.permissions.some((permission) =>
      input.restrictedPermissions.includes(permission),
    );
  }

  /** Ambil statistik inventory untuk dashboard route. */
  async getInventoryStats(input: { siteId?: string; startOfDay: Date }) {
    return this.repository.findInventoryStats(input);
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

  /** Setujui purchase request dan catat penyetujunya. */
  async approvePurchaseRequest(input: { id: string; approverId: string }) {
    const approved = await this.repository.approvePurchaseRequest(input);
    recordInventoryActivity({
      action: INVENTORY_ACTIVITY_ACTIONS.APPROVE,
      subject: INVENTORY_ACTIVITY_SUBJECTS.RESTOCK_REQUEST,
      reference: approved.nomorRequest,
      actorId: input.approverId,
      tenantId: approved.tenantId,
      details: { purchaseRequestId: input.id },
    });
    return approved;
  }

  /** Ambil info proses purchase request milik tenant tertentu. */
  async getPurchaseRequestProcessInfo(id: string, tenantId: string) {
    return this.repository.findPurchaseRequestProcessInfo(id, tenantId);
  }

  /** Ambil summary opname inventory. */
  async getOpnameSummary(gudangId?: string) {
    return this.repository.findOpnameSummary(gudangId);
  }

  /** Ambil laporan opname inventory. */
  async getOpnameReport(gudangId?: string) {
    const gudangList = await this.repository.findOpnameReport(gudangId);
    return buildOpnameReportResponse(gudangList);
  }

  /** Hitung data awal opname untuk gudang. */
  async calculateOpname(gudangId: string) {
    const items = await this.repository.calculateOpname(gudangId);
    return buildCalculatedOpnameResponse(items);
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
