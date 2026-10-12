const LOW_STOCK_RATIO = 0.5;
import { toEndOfDay, toStartOfDay } from "@/lib/utils/server-datetime";
import { prisma } from "@/modules/database";

const DEFAULT_STOCKOUT_DAYS = 999;
const USAGE_TREND_THRESHOLD_RATIO = 0.1;
const MONTHLY_USAGE_WINDOW = 6;

export type RestockPredictionItem = {
  barangId: string;
  gudangId: string;
  barangKode: string;
  barangNama: string;
  satuan: string;
  gudangKode: string;
  gudangNama: string;
  currentStok: number;
  minStok: number;
  maxStok: number;
  avgDailyUsage: number;
  leadTimeDays: number;
  safetyStok: number;
  daysUntilStockout: number;
  reorderPoint: number;
  recommendedOrderQty: number;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  lastRestockDate?: string;
  usageTrend: "INCREASING" | "DECREASING" | "STABLE";
  monthlyUsage: number[];
  nextRestockDate: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

/** Hitung urgency prediksi restock. */
export function calculatePredictionUrgency(
  currentStok: number,
  minStok: number,
  leadTimeDays: number,
  daysUntilStockout: number,
) {
  if (currentStok === 0) return "CRITICAL" as const;
  if (currentStok <= minStok) return "HIGH" as const;
  if (daysUntilStockout <= leadTimeDays) return "HIGH" as const;
  if (daysUntilStockout <= leadTimeDays * 2) return "MEDIUM" as const;
  return "LOW" as const;
}

/** Hitung level risiko prediksi restock. */
export function calculateRiskLevel(
  leadTimeDays: number,
  daysUntilStockout: number,
) {
  if (daysUntilStockout <= leadTimeDays) return "HIGH" as const;
  if (daysUntilStockout <= leadTimeDays * 2) return "MEDIUM" as const;
  return "LOW" as const;
}

/** Hitung tanggal restock berikutnya. */
export function calculateNextRestockDate(
  avgDailyUsage: number,
  currentStok: number,
  daysUntilStockout: number,
  leadTimeDays: number,
) {
  const nextRestockDate = new Date();
  if (avgDailyUsage > 0 && currentStok > 0) {
    nextRestockDate.setDate(
      nextRestockDate.getDate() + Math.max(0, daysUntilStockout - leadTimeDays),
    );
    return nextRestockDate.toISOString();
  }
  nextRestockDate.setDate(nextRestockDate.getDate() + leadTimeDays);
  return nextRestockDate.toISOString();
}

/** Hitung tren penggunaan barang bulanan. */
export function calculateUsageTrend(monthlyUsage: number[]) {
  if (monthlyUsage.length < 3) return "STABLE" as const;
  const count = monthlyUsage.length;
  const points = Array.from({ length: count }, (_, index) => index);
  const sumX = points.reduce((sum, value) => sum + value, 0);
  const sumY = monthlyUsage.reduce((sum, value) => sum + value, 0);
  const sumXY = points.reduce(
    (sum, point, index) => sum + point * (monthlyUsage[index] || 0),
    0,
  );
  const sumX2 = points.reduce((sum, point) => sum + point * point, 0);
  const slope = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);
  const threshold = (sumY / count) * USAGE_TREND_THRESHOLD_RATIO;
  if (slope > threshold) return "INCREASING" as const;
  if (slope < -threshold) return "DECREASING" as const;
  return "STABLE" as const;
}

/** Bangun keputusan alert restock. */
export function buildAlertDecision(
  setting: {
    barang: { nama: string; satuan: string };
    gudang: { nama: string };
    minStok: number;
    maxStok: number;
  },
  currentStock: number,
) {
  if (currentStock === 0) {
    return {
      alertType: "STOCK_OUT" as const,
      urgency: "CRITICAL" as const,
      message: `STOK HABIS! ${setting.barang.nama} di ${setting.gudang.nama} kosong`,
    };
  }
  if (currentStock <= setting.minStok) {
    return {
      alertType: "LOW_STOCK" as const,
      urgency:
        currentStock <= setting.minStok * LOW_STOCK_RATIO
          ? ("HIGH" as const)
          : ("MEDIUM" as const),
      message: `Stok rendah! ${setting.barang.nama} di ${setting.gudang.nama} tersisa ${currentStock} ${setting.barang.satuan} (min: ${setting.minStok})`,
    };
  }
  if (currentStock > setting.maxStok) {
    return {
      alertType: "OVERSTOCK" as const,
      urgency: "LOW" as const,
      message: `Stok berlebih! ${setting.barang.nama} di ${setting.gudang.nama} sebanyak ${currentStock} ${setting.barang.satuan} (max: ${setting.maxStok})`,
    };
  }
  return null;
}

/** Hitung stok per kondisi dari histori masuk dan keluar. */
export function calculateStockByCondition(
  masukItems: Array<{ kondisi: string; jumlah: number }>,
  keluarItems: Array<{ kondisi: string; jumlah: number }>,
) {
  let stokBaru = 0;
  let stokBekas = 0;
  let stokRusak = 0;
  masukItems.forEach((item) => {
    if (item.kondisi === "BEKAS") stokBekas += item.jumlah;
    else if (item.kondisi === "RUSAK") stokRusak += item.jumlah;
    else stokBaru += item.jumlah;
  });
  keluarItems.forEach((item) => {
    if (item.kondisi === "BEKAS")
      stokBekas = Math.max(0, stokBekas - item.jumlah);
    else if (item.kondisi === "RUSAK")
      stokRusak = Math.max(0, stokRusak - item.jumlah);
    else stokBaru = Math.max(0, stokBaru - item.jumlah);
  });
  return { stokBaru, stokBekas, stokRusak };
}

/**
 * Sesuaikan rincian stok per kondisi terhadap stok sistem.
 *
 * Stok sistem adalah angka otoritatif; rincian per kondisi direkap dari mutasi
 * masuk/keluar dan bisa menyimpang darinya. Fungsi ini mengembalikan rincian
 * yang **selalu berjumlah persis `stokSistem`** — invarian yang bukan sekadar
 * kerapian: baris opname dikirim ke `POST /api/inventory/opname/batch`, yang
 * menolak dengan 400 bila baik + rusak + expire melebihi stok fisik. Versi
 * sebelumnya hanya menambal `kondisiBaik` lalu menjepitnya di nol, sehingga
 * ketika bekas + rusak hasil rekap sudah melampaui stok sistem, server
 * menyuguhkan baris yang kemudian ditolaknya sendiri — dan operator tidak bisa
 * menyimpan opname sama sekali.
 *
 * Kelebihan dipangkas berurutan: `kondisiBaik` lebih dulu, lalu `kondisiExpire`,
 * dan `kondisiRusak` paling akhir. Barang rusak adalah angka yang paling tidak
 * boleh berkurang diam-diam — ia menjadi dasar klaim dan penghapusan aset,
 * sedangkan barang baik paling mudah dikoreksi ulang saat perhitungan fisik.
 */
export function adjustStockCalculation(
  stokSistem: number,
  stockByCondition: { stokBaru: number; stokBekas: number; stokRusak: number },
) {
  const target = Math.max(0, stokSistem);
  const rekapTotal =
    stockByCondition.stokBaru +
    stockByCondition.stokBekas +
    stockByCondition.stokRusak;

  // Kekurangan ditambahkan ke stok baik; kelebihan dipangkas berurutan.
  const baikKasar = stockByCondition.stokBaru + (target - rekapTotal);
  let sisaKelebihan = Math.max(0, -baikKasar);

  const potongDari = (nilai: number) => {
    const potongan = Math.min(sisaKelebihan, nilai);
    sisaKelebihan -= potongan;
    return nilai - potongan;
  };

  const kondisiBaik = Math.max(0, baikKasar);
  const kondisiExpire = potongDari(stockByCondition.stokBekas);
  const kondisiRusak = potongDari(stockByCondition.stokRusak);

  return { kondisiBaik, kondisiRusak, kondisiExpire };
}

/** Ambil penggunaan bulanan dengan label bulan. */
export async function findMonthlyUsageWithLabels(
  barangId: string,
  gudangId: string,
) {
  const monthlyUsage = [];
  for (let offset = MONTHLY_USAGE_WINDOW - 1; offset >= 0; offset -= 1) {
    const { startDate, endDate } = buildMonthRange(offset);
    const usage = await findMonthlyUsageTotal(
      barangId,
      gudangId,
      startDate,
      endDate,
    );
    monthlyUsage.push({ month: formatMonthLabel(startDate), usage });
  }
  return monthlyUsage;
}

/** Ambil angka penggunaan bulanan untuk prediksi restock. */
export async function findMonthlyUsageNumbers(
  barangId: string,
  gudangId: string,
  months: number,
) {
  const values: number[] = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const { startDate, endDate } = buildMonthRange(offset);
    values.push(
      await findMonthlyUsageTotal(barangId, gudangId, startDate, endDate),
    );
  }
  return values;
}

function buildMonthRange(offset: number) {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - offset, 1);
  startDate.setTime(toStartOfDay(startDate).getTime());
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  endDate.setDate(0);
  endDate.setTime(toEndOfDay(endDate).getTime());
  return { startDate, endDate };
}

function formatMonthLabel(startDate: Date) {
  return startDate.toLocaleString("id-ID", { month: "short", year: "numeric" });
}

async function findMonthlyUsageTotal(
  barangId: string,
  gudangId: string,
  startDate: Date,
  endDate: Date,
) {
  const usage = await prisma.barangKeluar.aggregate({
    where: { barangId, gudangId, tanggal: { gte: startDate, lte: endDate } },
    _sum: { jumlah: true },
  });
  return usage._sum.jumlah || 0;
}

export { DEFAULT_STOCKOUT_DAYS };
