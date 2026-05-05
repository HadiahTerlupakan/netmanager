import { Prisma } from "@prisma/client";
import {
  calculateNextRestockDate,
  calculatePredictionUrgency,
  calculateRiskLevel,
  calculateUsageTrend,
  DEFAULT_STOCKOUT_DAYS,
  findMonthlyUsageNumbers,
  type RestockPredictionItem,
} from "./inventory-api-repository-helpers";

const MONTHLY_USAGE_WINDOW = 6;

type PrismaClientLike = Prisma.TransactionClient;

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
