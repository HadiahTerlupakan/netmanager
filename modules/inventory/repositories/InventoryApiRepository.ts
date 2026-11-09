import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import {
  InventoryOpnameApiRepository,
  type OpnameGudangScope,
} from "./InventoryOpnameApiRepository";
import { InventoryPurchaseRequestRepository } from "./InventoryPurchaseRequestRepository";
import { InventoryRestockRepository } from "./InventoryRestockRepository";
import { InventoryTransactionVerificationRepository } from "./InventoryTransactionVerificationRepository";

export class InventoryApiRepository {
  private readonly opnameRepository: InventoryOpnameApiRepository;
  private readonly purchaseRequestRepository: InventoryPurchaseRequestRepository;
  private readonly restockRepository: InventoryRestockRepository;
  private readonly verificationRepository: InventoryTransactionVerificationRepository;

  constructor(private readonly db: Prisma.TransactionClient = prisma) {
    this.opnameRepository = new InventoryOpnameApiRepository(this.db);
    this.purchaseRequestRepository = new InventoryPurchaseRequestRepository(
      this.db,
    );
    this.restockRepository = new InventoryRestockRepository(this.db);
    this.verificationRepository =
      new InventoryTransactionVerificationRepository(this.db);
  }

  /**
   * Ambil statistik inventory berbasis filter site. `siteIds` kosong berarti
   * tidak ada gudang yang cocok, bukan tanpa pembatasan.
   */
  async findInventoryStats(input: { siteIds?: string[]; startOfDay: Date }) {
    const gudangFilter: Prisma.GudangWhereInput = { isActive: true };
    const masukFilter: Prisma.BarangMasukWhereInput = {
      createdAt: { gte: input.startOfDay },
    };
    const keluarFilter: Prisma.BarangKeluarWhereInput = {
      createdAt: { gte: input.startOfDay },
    };
    this.applySiteFilter(
      input.siteIds,
      gudangFilter,
      masukFilter,
      keluarFilter,
    );
    const [totalBarang, barangMasukToday, barangKeluarToday, totalGudang] =
      await Promise.all([
        this.db.barang.count(),
        this.db.barangMasuk.count({ where: masukFilter }),
        this.db.barangKeluar.count({ where: keluarFilter }),
        this.db.gudang.count({ where: gudangFilter }),
      ]);
    return { totalBarang, barangMasukToday, barangKeluarToday, totalGudang };
  }

  /** Ambil analitik penggunaan barang per gudang. */
  async findUsageAnalytics(input: {
    barangId: string;
    gudangId: string;
    days: number;
  }) {
    return this.restockRepository.findUsageAnalytics(input);
  }

  /** Ambil daftar alert restock beserta jumlah unread. */
  async findRestockAlerts(input: {
    barangId?: string;
    gudangId?: string;
    isRead?: boolean;
    isResolved?: boolean;
    urgency?: string;
    page: number;
    limit: number;
  }) {
    return this.restockRepository.findRestockAlerts(input);
  }

  /** Jalankan auto check dan buat alert restock baru bila perlu. */
  async autoCheckRestockAlerts() {
    return this.restockRepository.autoCheckRestockAlerts();
  }

  /** Ambil daftar pengaturan restock. */
  async findRestockSettings(input: {
    barangId?: string;
    gudangId?: string;
    page: number;
    limit: number;
  }) {
    return this.restockRepository.findRestockSettings(input);
  }

  /** Simpan pengaturan restock dan buat alert jika stok rendah. */
  async saveRestockSettings(input: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    safetyStok?: number;
    leadTimeDays?: number;
  }) {
    return this.restockRepository.saveRestockSettings(input);
  }

  /** Bangun prediksi restock dari setting aktif. */
  async findRestockPredictions(input: { gudangId?: string; days: number }) {
    return this.restockRepository.findRestockPredictions(input);
  }

  /** Ambil daftar purchase request restock. */
  async findPurchaseRequests(input: {
    tenantId: string;
    status?: string | null;
    siteIds?: string[];
  }) {
    return this.purchaseRequestRepository.findPurchaseRequests(input);
  }

  /** Ambil purchase request milik tenant tertentu. */
  async findPurchaseRequestById(input: { id: string; tenantId: string }) {
    return this.purchaseRequestRepository.findPurchaseRequestById(input);
  }

  /** Perbarui item purchase request draft/submitted. */
  async updatePurchaseRequest(input: {
    id: string;
    tenantId: string;
    gudangId: string;
    keterangan?: string;
    items: Array<{
      barangId: string;
      quantity: number;
      keterangan?: string | null;
    }>;
  }) {
    return this.purchaseRequestRepository.updatePurchaseRequest(input);
  }

  /** Hapus purchase request. */
  async deletePurchaseRequest(id: string) {
    return this.purchaseRequestRepository.deletePurchaseRequest(id);
  }

  /** True bila PO pengajuan sudah punya barang yang datang. */
  async hasArrivedGoods(purchaseOrderId: string) {
    return this.purchaseRequestRepository.hasArrivedGoods(purchaseOrderId);
  }

  /** True bila PO pengajuan sudah punya catatan belanja. */
  async hasPurchaseRecords(purchaseOrderId: string) {
    return this.purchaseRequestRepository.hasPurchaseRecords(purchaseOrderId);
  }

  /** Ambil ringkasan purchase request untuk proses receive/start shopping. */
  async findPurchaseRequestProcessInfo(id: string, tenantId: string) {
    return this.purchaseRequestRepository.findPurchaseRequestProcessInfo(
      id,
      tenantId,
    );
  }

  /** Ambil summary opname berbasis stok dan opname terakhir. */
  async findOpnameSummary(input: OpnameGudangScope) {
    return this.opnameRepository.findOpnameSummary(input);
  }

  /** Ambil laporan opname per gudang. */
  async findOpnameReport(input: OpnameGudangScope) {
    return this.opnameRepository.findOpnameReport(input);
  }

  /** Hitung data awal opname untuk satu gudang. */
  async calculateOpname(gudangId: string) {
    return this.opnameRepository.calculateOpname(gudangId);
  }

  /** Ambil stok barang dan relasinya. */
  async findStockInfo(barangId: string, gudangId: string) {
    return this.opnameRepository.findStockInfo(barangId, gudangId);
  }

  /** Ambil breakdown stok per kondisi. */
  async findStockBreakdown(barangId: string, gudangId: string) {
    return this.opnameRepository.findStockBreakdown(barangId, gudangId);
  }

  /** Ambil keluar record beserta site gudang untuk validasi akses. */
  async findKeluarRecordWithSite(id: string) {
    return this.opnameRepository.findKeluarRecordWithSite(id);
  }

  /** Perbarui keluar record dan sinkronkan stok. */
  async updateKeluarRecord(input: {
    id: string;
    jumlah: number;
    keterangan?: string;
  }) {
    return this.opnameRepository.updateKeluarRecord(input);
  }

  /** Hapus keluar record dan kembalikan stok. */
  async deleteKeluarRecord(id: string) {
    return this.opnameRepository.deleteKeluarRecord(id);
  }

  /** Verifikasi transaksi upload foto inventory. */
  async verifyInventoryTransaction(input: {
    transactionId: string;
    transactionType: string;
  }) {
    return this.verificationRepository.verifyInventoryTransaction(input);
  }

  private applySiteFilter(
    siteIds: string[] | undefined,
    gudangFilter: Prisma.GudangWhereInput,
    masukFilter: Prisma.BarangMasukWhereInput,
    keluarFilter: Prisma.BarangKeluarWhereInput,
  ) {
    if (!siteIds) return;
    const siteFilter = { sites: { some: { id: { in: siteIds } } } };
    gudangFilter.sites = siteFilter.sites;
    masukFilter.gudang = siteFilter;
    keluarFilter.gudang = siteFilter;
  }
}
