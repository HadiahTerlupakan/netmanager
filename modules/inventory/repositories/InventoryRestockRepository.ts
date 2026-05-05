import { Prisma } from "@prisma/client";
import { findMonthlyUsageWithLabels } from "./inventory-api-repository-helpers";
import {
  buildRestockPrediction,
  createRestockAlertFromSetting,
  createThresholdAlertIfNeeded,
  getRestockSettingContext,
  sortRestockPredictions,
  upsertRestockSettings,
} from "./inventory-restock-repository.helpers";

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
      const alert = await createRestockAlertFromSetting(this.db, setting);
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
      const context = await getRestockSettingContext(tx, input);
      const settings = await upsertRestockSettings(
        tx,
        input,
        context.avgDailyUsage,
      );
      await createThresholdAlertIfNeeded(tx, {
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
        buildRestockPrediction(this.db, setting, input.days),
      ),
    );
    return predictions.sort(sortRestockPredictions);
  }
}
