import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  buildAlertDecision,
  calculateNextRestockDate,
  calculatePredictionUrgency,
  calculateRiskLevel,
  calculateUsageTrend,
  DEFAULT_STOCKOUT_DAYS,
  findMonthlyUsageNumbers,
  findMonthlyUsageWithLabels,
  type RestockPredictionItem,
} from "./inventory-api-repository-helpers";

const DEFAULT_RESTOCK_LEAD_DAYS = 7;
const THIRTY_DAYS = 30;
const MONTHLY_USAGE_WINDOW = 6;

type PrismaClientLike = Prisma.TransactionClient;

export class InventoryRestockRepository {
  constructor(private readonly db: PrismaClientLike) {}

  /** Ambil analitik penggunaan barang per gudang. */
  async findUsageAnalytics(input: {
    barangId: string;
    gudangId: string;
    days: number;
  }) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - input.days);
    const [usageData, monthlyUsage, currentStock] = await Promise.all([
      this.db.barangKeluar.aggregate({
        where: {
          barangId: input.barangId,
          gudangId: input.gudangId,
          tanggal: { gte: startDate },
        },
        _sum: { jumlah: true },
        _count: { id: true },
      }),
      findMonthlyUsageWithLabels(input.barangId, input.gudangId),
      this.db.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: input.barangId,
            gudangId: input.gudangId,
          },
        },
      }),
    ]);
    return { usageData, monthlyUsage, currentStock };
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
    const where: Prisma.RestockAlertsWhereInput = {};
    const offset = (input.page - 1) * input.limit;
    if (input.barangId) where.barangId = input.barangId;
    if (input.gudangId) where.gudangId = input.gudangId;
    if (input.isRead !== undefined) where.isRead = input.isRead;
    if (input.isResolved !== undefined) where.isResolved = input.isResolved;
    if (input.urgency) where.urgency = input.urgency as never;
    const [alerts, total, unreadCount] = await Promise.all([
      this.db.restockAlerts.findMany({
        where,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
        skip: offset,
        take: input.limit,
      }),
      this.db.restockAlerts.count({ where }),
      this.db.restockAlerts.count({
        where: { ...where, isRead: false, isResolved: false },
      }),
    ]);
    return { alerts, total, unreadCount };
  }

  /** Jalankan auto check dan buat alert restock baru bila perlu. */
  async autoCheckRestockAlerts() {
    const settings = await this.db.restockSettings.findMany({
      where: { isActive: true },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
    const newAlerts = [];
    for (const setting of settings) {
      const alert = await this.createRestockAlertFromSetting(setting);
      if (alert) newAlerts.push(alert);
    }
    return newAlerts;
  }

  /** Ambil daftar pengaturan restock. */
  async findRestockSettings(input: {
    barangId?: string;
    gudangId?: string;
    page: number;
    limit: number;
  }) {
    const where: Prisma.RestockSettingsWhereInput = {};
    const offset = (input.page - 1) * input.limit;
    if (input.barangId) where.barangId = input.barangId;
    if (input.gudangId) where.gudangId = input.gudangId;
    const [settings, total] = await Promise.all([
      this.db.restockSettings.findMany({
        where,
        include: {
          barang: {
            select: { id: true, kode: true, nama: true, satuan: true },
          },
          gudang: { select: { id: true, kode: true, nama: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: input.limit,
      }),
      this.db.restockSettings.count({ where }),
    ]);
    return { settings, total };
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
    return this.db.$transaction(async (tx) => {
      const context = await this.getRestockSettingContext(tx, input);
      const settings = await this.upsertRestockSettings(
        tx,
        input,
        context.avgDailyUsage,
      );
      await this.createThresholdAlertIfNeeded(tx, {
        ...input,
        barangNama: context.barang.nama,
        gudangNama: context.gudang.nama,
        satuan: context.barang.satuan,
      });
      return settings;
    });
  }

  /** Bangun prediksi restock dari setting aktif. */
  async findRestockPredictions(input: { gudangId?: string; days: number }) {
    const where: Prisma.RestockSettingsWhereInput = { isActive: true };
    if (input.gudangId) where.gudangId = input.gudangId;
    const settings = await this.db.restockSettings.findMany({
      where,
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
    const predictions = await Promise.all(
      settings.map((setting) =>
        this.buildRestockPrediction(setting, input.days),
      ),
    );
    return predictions.sort(this.sortPredictions);
  }

  private async createRestockAlertFromSetting(setting: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
  }) {
    const stock = await this.db.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: setting.barangId,
          gudangId: setting.gudangId,
        },
      },
    });
    if (!stock) return null;
    const decision = buildAlertDecision(setting, stock.stok);
    if (!decision) return null;
    const existing = await this.db.restockAlerts.findFirst({
      where: {
        barangId: setting.barangId,
        gudangId: setting.gudangId,
        alertType: decision.alertType,
        isResolved: false,
      },
    });
    if (existing) return null;
    return this.db.restockAlerts.create({
      data: {
        id: randomUUID(),
        barangId: setting.barangId,
        gudangId: setting.gudangId,
        alertType: decision.alertType,
        currentStok: stock.stok,
        minStok: setting.minStok,
        recommendedOrder: Math.max(0, setting.maxStok - stock.stok),
        urgency: decision.urgency,
        message: decision.message,
      },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
  }

  private async getRestockSettingContext(
    tx: Prisma.TransactionClient,
    input: { barangId: string; gudangId: string },
  ) {
    const [barang, gudang, usageData] = await Promise.all([
      tx.barang.findUnique({ where: { id: input.barangId } }),
      tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
      this.findRecentUsage(tx, input),
    ]);
    if (!barang) throw new Error("Barang tidak ditemukan");
    if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");
    return {
      barang,
      gudang,
      avgDailyUsage: (usageData._sum.jumlah || 0) / THIRTY_DAYS,
    };
  }

  private findRecentUsage(
    tx: Prisma.TransactionClient,
    input: { barangId: string; gudangId: string },
  ) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - THIRTY_DAYS);
    return tx.barangKeluar.aggregate({
      where: {
        barangId: input.barangId,
        gudangId: input.gudangId,
        tanggal: { gte: thirtyDaysAgo },
      },
      _sum: { jumlah: true },
    });
  }

  private upsertRestockSettings(
    tx: Prisma.TransactionClient,
    input: {
      barangId: string;
      gudangId: string;
      minStok: number;
      maxStok: number;
      safetyStok?: number;
      leadTimeDays?: number;
    },
    avgDailyUsage: number,
  ) {
    const commonData = {
      minStok: input.minStok,
      maxStok: input.maxStok,
      safetyStok: input.safetyStok || 0,
      leadTimeDays: input.leadTimeDays || DEFAULT_RESTOCK_LEAD_DAYS,
      avgDailyUsage,
    };
    return tx.restockSettings.upsert({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
      update: {
        ...commonData,
        lastUsageCalculation: new Date(),
        isActive: true,
      },
      create: {
        id: randomUUID(),
        barangId: input.barangId,
        gudangId: input.gudangId,
        ...commonData,
        updatedAt: new Date(),
      },
      include: {
        barang: { select: { id: true, kode: true, nama: true, satuan: true } },
        gudang: { select: { id: true, kode: true, nama: true } },
      },
    });
  }

  private async createThresholdAlertIfNeeded(
    tx: Prisma.TransactionClient,
    input: {
      barangId: string;
      gudangId: string;
      minStok: number;
      maxStok: number;
      barangNama: string;
      gudangNama: string;
      satuan: string;
    },
  ) {
    const currentStock = await tx.barangGudang.findUnique({
      where: {
        barangId_gudangId: {
          barangId: input.barangId,
          gudangId: input.gudangId,
        },
      },
    });
    if (!currentStock || currentStock.stok > input.minStok) return;
    const existingAlert = await tx.restockAlerts.findFirst({
      where: {
        barangId: input.barangId,
        gudangId: input.gudangId,
        isResolved: false,
        alertType: "RESTOCK_NEEDED",
      },
    });
    if (existingAlert) return;
    await tx.restockAlerts.create({
      data: {
        id: randomUUID(),
        barangId: input.barangId,
        gudangId: input.gudangId,
        alertType: "RESTOCK_NEEDED",
        currentStok: currentStock.stok,
        minStok: input.minStok,
        recommendedOrder: input.maxStok - currentStock.stok,
        urgency: this.getThresholdUrgency(currentStock.stok, input.minStok),
        message: `Stok ${input.barangNama} di ${input.gudangNama} rendah. Sisa: ${currentStock.stok} ${input.satuan}, Min: ${input.minStok} ${input.satuan}`,
      },
    });
  }

  private getThresholdUrgency(currentStok: number, minStok: number) {
    if (currentStok === 0) return "CRITICAL";
    if (currentStok <= minStok * 0.5) return "HIGH";
    return "MEDIUM";
  }

  private async buildRestockPrediction(
    setting: {
      id: string;
      barangId: string;
      gudangId: string;
      minStok: number;
      maxStok: number;
      avgDailyUsage: number;
      leadTimeDays: number;
      safetyStok: number;
      barang: { kode: string; nama: string; satuan: string };
      gudang: { kode: string; nama: string };
    },
    days: number,
  ): Promise<RestockPredictionItem> {
    const usageContext = await this.getPredictionUsageContext(setting, days);
    const avgDailyUsage = (usageContext.recentUsage._sum.jumlah || 0) / days;
    await this.updateAverageUsageIfNeeded(setting, avgDailyUsage);
    const currentStok = usageContext.currentStock?.stok || 0;
    const daysUntilStockout =
      avgDailyUsage > 0
        ? Math.floor(currentStok / avgDailyUsage)
        : DEFAULT_STOCKOUT_DAYS;
    return this.toPredictionItem(setting, {
      ...usageContext,
      avgDailyUsage,
      currentStok,
      daysUntilStockout,
    });
  }

  private getPredictionUsageContext(
    setting: { barangId: string; gudangId: string },
    days: number,
  ) {
    const analysisStartDate = new Date();
    analysisStartDate.setDate(analysisStartDate.getDate() - days);
    return Promise.all([
      this.db.barangGudang.findUnique({
        where: {
          barangId_gudangId: {
            barangId: setting.barangId,
            gudangId: setting.gudangId,
          },
        },
      }),
      findMonthlyUsageNumbers(
        setting.barangId,
        setting.gudangId,
        MONTHLY_USAGE_WINDOW,
      ),
      this.db.barangMasuk.findFirst({
        where: {
          barangId: setting.barangId,
          gudangId: setting.gudangId,
          transferId: null,
        },
        orderBy: { tanggal: "desc" },
      }),
      this.db.barangKeluar.aggregate({
        where: {
          barangId: setting.barangId,
          gudangId: setting.gudangId,
          tanggal: { gte: analysisStartDate },
        },
        _sum: { jumlah: true },
      }),
    ]).then(([currentStock, monthlyUsage, lastRestock, recentUsage]) => ({
      currentStock,
      monthlyUsage,
      lastRestock,
      recentUsage,
    }));
  }

  private async updateAverageUsageIfNeeded(
    setting: { id: string; avgDailyUsage: number },
    avgDailyUsage: number,
  ) {
    if (avgDailyUsage === setting.avgDailyUsage) return;
    await this.db.restockSettings.update({
      where: { id: setting.id },
      data: { avgDailyUsage, lastUsageCalculation: new Date() },
    });
  }

  private toPredictionItem(
    setting: {
      barangId: string;
      gudangId: string;
      minStok: number;
      maxStok: number;
      leadTimeDays: number;
      safetyStok: number;
      barang: { kode: string; nama: string; satuan: string };
      gudang: { kode: string; nama: string };
    },
    context: Awaited<
      ReturnType<InventoryRestockRepository["getPredictionUsageContext"]>
    > & {
      avgDailyUsage: number;
      currentStok: number;
      daysUntilStockout: number;
    },
  ) {
    const usageDuringLeadTime = Math.ceil(
      context.avgDailyUsage * setting.leadTimeDays,
    );
    const urgency = calculatePredictionUrgency(
      context.currentStok,
      setting.minStok,
      setting.leadTimeDays,
      context.daysUntilStockout,
    );
    return {
      barangId: setting.barangId,
      gudangId: setting.gudangId,
      barangKode: setting.barang.kode,
      barangNama: setting.barang.nama,
      satuan: setting.barang.satuan,
      gudangKode: setting.gudang.kode,
      gudangNama: setting.gudang.nama,
      currentStok: context.currentStok,
      minStok: setting.minStok,
      maxStok: setting.maxStok,
      avgDailyUsage: context.avgDailyUsage,
      leadTimeDays: setting.leadTimeDays,
      safetyStok: setting.safetyStok,
      daysUntilStockout: context.daysUntilStockout,
      reorderPoint: setting.minStok + setting.safetyStok + usageDuringLeadTime,
      recommendedOrderQty: Math.max(0, setting.maxStok - context.currentStok),
      urgency,
      ...(context.lastRestock?.tanggal
        ? { lastRestockDate: context.lastRestock.tanggal.toISOString() }
        : {}),
      usageTrend: calculateUsageTrend(context.monthlyUsage),
      monthlyUsage: context.monthlyUsage,
      nextRestockDate: calculateNextRestockDate(
        context.avgDailyUsage,
        context.currentStok,
        context.daysUntilStockout,
        setting.leadTimeDays,
      ),
      riskLevel: calculateRiskLevel(
        setting.leadTimeDays,
        context.daysUntilStockout,
      ),
    };
  }

  private sortPredictions(
    firstItem: RestockPredictionItem,
    secondItem: RestockPredictionItem,
  ) {
    const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const urgencyDiff =
      urgencyOrder[secondItem.urgency] - urgencyOrder[firstItem.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return firstItem.daysUntilStockout - secondItem.daysUntilStockout;
  }
}
