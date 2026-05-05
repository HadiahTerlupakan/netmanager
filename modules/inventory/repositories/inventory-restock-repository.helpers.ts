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
  type RestockPredictionItem,
} from "./inventory-api-repository-helpers";

const DEFAULT_RESTOCK_LEAD_DAYS = 7;
const THIRTY_DAYS = 30;
const MONTHLY_USAGE_WINDOW = 6;
const LOW_STOCK_URGENCY_RATIO = 0.5;

type PrismaClientLike = Prisma.TransactionClient;

type RestockSettingsInput = {
  barangId: string;
  gudangId: string;
  minStok: number;
  maxStok: number;
  safetyStok?: number;
  leadTimeDays?: number;
};

type RestockPredictionSetting = {
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
};

/** Buat alert otomatis dari setting restock aktif bila stok melanggar ambang. */
export async function createRestockAlertFromSetting(
  db: PrismaClientLike,
  setting: {
    barangId: string;
    gudangId: string;
    minStok: number;
    maxStok: number;
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
  },
) {
  const stock = await db.barangGudang.findUnique({
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

  const existing = await db.restockAlerts.findFirst({
    where: {
      barangId: setting.barangId,
      gudangId: setting.gudangId,
      alertType: decision.alertType,
      isResolved: false,
    },
  });
  if (existing) return null;

  return db.restockAlerts.create({
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

/** Ambil konteks validasi barang, gudang, dan rata-rata usage untuk setting restock. */
export async function getRestockSettingContext(
  tx: Prisma.TransactionClient,
  input: Pick<RestockSettingsInput, "barangId" | "gudangId">,
) {
  const [barang, gudang, usageData] = await Promise.all([
    tx.barang.findUnique({ where: { id: input.barangId } }),
    tx.gudang.findUnique({ where: { id: input.gudangId, isActive: true } }),
    findRecentUsage(tx, input),
  ]);

  if (!barang) throw new Error("Barang tidak ditemukan");
  if (!gudang) throw new Error("Gudang tidak ditemukan atau tidak aktif");

  return {
    barang,
    gudang,
    avgDailyUsage: (usageData._sum.jumlah || 0) / THIRTY_DAYS,
  };
}

/** Simpan atau aktifkan kembali setting restock. */
export function upsertRestockSettings(
  tx: Prisma.TransactionClient,
  input: RestockSettingsInput,
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
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
    },
    update: { ...commonData, lastUsageCalculation: new Date(), isActive: true },
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

/** Buat alert threshold bila stok saat ini sudah di bawah minimum. */
export async function createThresholdAlertIfNeeded(
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
      barangId_gudangId: { barangId: input.barangId, gudangId: input.gudangId },
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
      urgency: getThresholdUrgency(currentStock.stok, input.minStok),
      message: `Stok ${input.barangNama} di ${input.gudangNama} rendah. Sisa: ${currentStock.stok} ${input.satuan}, Min: ${input.minStok} ${input.satuan}`,
    },
  });
}

/** Bangun prediksi restock dari histori penggunaan dan stok terakhir. */
export async function buildRestockPrediction(
  db: PrismaClientLike,
  setting: RestockPredictionSetting,
  days: number,
): Promise<RestockPredictionItem> {
  const usageContext = await getPredictionUsageContext(db, setting, days);
  const avgDailyUsage = (usageContext.recentUsage._sum.jumlah || 0) / days;
  await updateAverageUsageIfNeeded(db, setting, avgDailyUsage);

  const currentStok = usageContext.currentStock?.stok || 0;
  const daysUntilStockout =
    avgDailyUsage > 0
      ? Math.floor(currentStok / avgDailyUsage)
      : DEFAULT_STOCKOUT_DAYS;

  return toPredictionItem(setting, {
    ...usageContext,
    avgDailyUsage,
    currentStok,
    daysUntilStockout,
  });
}

/** Urutkan prediksi berdasarkan urgency lalu risiko kehabisan stok. */
export function sortRestockPredictions(
  firstItem: RestockPredictionItem,
  secondItem: RestockPredictionItem,
) {
  const urgencyOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  const urgencyDiff =
    urgencyOrder[secondItem.urgency] - urgencyOrder[firstItem.urgency];
  if (urgencyDiff !== 0) return urgencyDiff;
  return firstItem.daysUntilStockout - secondItem.daysUntilStockout;
}

function findRecentUsage(
  tx: Prisma.TransactionClient,
  input: Pick<RestockSettingsInput, "barangId" | "gudangId">,
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

function getThresholdUrgency(currentStok: number, minStok: number) {
  if (currentStok === 0) return "CRITICAL";
  if (currentStok <= minStok * LOW_STOCK_URGENCY_RATIO) return "HIGH";
  return "MEDIUM";
}

function getPredictionUsageContext(
  db: PrismaClientLike,
  setting: Pick<RestockPredictionSetting, "barangId" | "gudangId">,
  days: number,
) {
  const analysisStartDate = new Date();
  analysisStartDate.setDate(analysisStartDate.getDate() - days);

  return Promise.all([
    db.barangGudang.findUnique({
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
    db.barangMasuk.findFirst({
      where: {
        barangId: setting.barangId,
        gudangId: setting.gudangId,
        transferId: null,
      },
      orderBy: { tanggal: "desc" },
    }),
    db.barangKeluar.aggregate({
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

async function updateAverageUsageIfNeeded(
  db: PrismaClientLike,
  setting: Pick<RestockPredictionSetting, "id" | "avgDailyUsage">,
  avgDailyUsage: number,
) {
  if (avgDailyUsage === setting.avgDailyUsage) return;
  await db.restockSettings.update({
    where: { id: setting.id },
    data: { avgDailyUsage, lastUsageCalculation: new Date() },
  });
}

function toPredictionItem(
  setting: RestockPredictionSetting,
  context: Awaited<ReturnType<typeof getPredictionUsageContext>> & {
    avgDailyUsage: number;
    currentStok: number;
    daysUntilStockout: number;
  },
): RestockPredictionItem {
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
