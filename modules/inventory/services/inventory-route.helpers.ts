const STOCKOUT_WARNING_DAYS = 7;
const TREND_COMPARISON_SIZE = 2;
const INCREASING_THRESHOLD = 1.1;
const DECREASING_THRESHOLD = 0.9;

/** Hitung tren penggunaan barang berdasarkan data bulanan. */
export function calculateUsageTrend(monthlyUsage: Array<{ usage: number }>) {
  if (monthlyUsage.length < 3) return "STABLE" as const;

  const recentAvg = calculateAverageUsage(monthlyUsage.slice(-2));
  const olderAvg = calculateAverageUsage(
    monthlyUsage.slice(0, TREND_COMPARISON_SIZE),
  );

  if (recentAvg > olderAvg * INCREASING_THRESHOLD) {
    return "INCREASING" as const;
  }

  if (recentAvg < olderAvg * DECREASING_THRESHOLD) {
    return "DECREASING" as const;
  }

  return "STABLE" as const;
}

/** Bentuk response analitik penggunaan inventory. */
export function buildUsageAnalyticsResponse(input: {
  barangId: string;
  gudangId: string;
  days: number;
  usageData: { _sum: { jumlah: number | null }; _count: { id: number } };
  currentStock?: { stok: number } | null;
  monthlyUsage: Array<{ usage: number }>;
}) {
  const totalUsage = input.usageData._sum.jumlah || 0;
  const transactionCount = input.usageData._count.id;

  return {
    barangId: input.barangId,
    gudangId: input.gudangId,
    days: input.days,
    totalUsage,
    avgDailyUsage: totalUsage / input.days,
    avgPerTransaction: transactionCount > 0 ? totalUsage / transactionCount : 0,
    transactionCount,
    currentStock: input.currentStock?.stok || 0,
    usageTrend: calculateUsageTrend(input.monthlyUsage),
    monthlyUsage: input.monthlyUsage,
    lastCalculated: new Date().toISOString(),
  };
}

/** Bentuk response alert restock dengan pagination. */
export function buildRestockAlertsResponse(input: {
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
  alerts: unknown[];
}) {
  return {
    alerts: input.alerts,
    pagination: {
      page: input.page,
      limit: input.limit,
      total: input.total,
      totalPages: Math.ceil(input.total / input.limit),
    },
    unreadCount: input.unreadCount,
  };
}

/** Bentuk summary prediksi restock. */
export function buildRestockPredictionSummary(
  predictions: Array<{ urgency: string; daysUntilStockout: number }>,
) {
  return {
    totalItems: predictions.length,
    criticalItems: countByUrgency(predictions, "CRITICAL"),
    highPriorityItems: countByUrgency(predictions, "HIGH"),
    mediumPriorityItems: countByUrgency(predictions, "MEDIUM"),
    lowPriorityItems: countByUrgency(predictions, "LOW"),
    stockoutRiskItems: predictions.filter(
      (item) => item.daysUntilStockout <= STOCKOUT_WARNING_DAYS,
    ).length,
  };
}

/** Bentuk response laporan opname gudang. */
export function buildOpnameReportResponse(
  gudangList: Array<{
    totalBarang: number;
    totalStok: number;
    totalHilang: number;
  }>,
) {
  return {
    gudangList,
    summary: {
      totalGudang: gudangList.length,
      totalBarang: sumBy(gudangList, "totalBarang"),
      totalStok: sumBy(gudangList, "totalStok"),
      totalHilang: sumBy(gudangList, "totalHilang"),
    },
  };
}

/** Bentuk response kalkulasi opname awal. */
export function buildCalculatedOpnameResponse(
  items: Array<{ stokSistem: number }>,
) {
  return {
    items,
    summary: {
      totalBarang: items.length,
      totalStok: sumBy(items, "stokSistem"),
    },
  };
}

/** Bentuk response breakdown stok per kondisi. */
export function buildStockBreakdownResponse(input: {
  stockSnapshot?: {
    stok?: number | null;
    stokBaru?: number | null;
    stokBekas?: number | null;
    stokRusak?: number | null;
  } | null;
  barangInfo: unknown;
  gudangInfo: unknown;
}) {
  const stockPerKondisi = {
    BARU: Math.max(input.stockSnapshot?.stokBaru || 0, 0),
    BEKAS: Math.max(input.stockSnapshot?.stokBekas || 0, 0),
    RUSAK: Math.max(input.stockSnapshot?.stokRusak || 0, 0),
  };
  const totalStock = Math.max(
    input.stockSnapshot?.stok ||
      Object.values(stockPerKondisi).reduce((sum, stock) => sum + stock, 0),
    0,
  );

  return {
    totalStock,
    stockPerKondisi,
    barang: input.barangInfo,
    gudang: input.gudangInfo,
  };
}

function calculateAverageUsage(items: Array<{ usage: number }>) {
  return items.reduce((sum, item) => sum + item.usage, 0) / items.length;
}

function countByUrgency(
  predictions: Array<{ urgency: string }>,
  urgency: string,
) {
  return predictions.filter((item) => item.urgency === urgency).length;
}

function sumBy<T extends Record<string, number>>(items: T[], key: keyof T) {
  return items.reduce((sum, item) => sum + item[key], 0);
}
