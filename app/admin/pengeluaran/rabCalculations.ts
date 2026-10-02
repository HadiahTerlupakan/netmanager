import { buildRABTrackingDataset, calculateMonthlySubscribers } from "@/modules/finance/client";
import type { RABProject } from "./rabTypes";

/** Penagihan pascabayar baru masuk sebulan setelah pelanggan aktif. */
const JEDA_TAGIHAN_PASCABAYAR_BULAN = 1;

/**
 * BEP sederhana (kapasitas penuh): CAPEX ÷ laba per bulan, ditambah jeda
 * tagihan sebulan untuk pascabayar. Dipakai form dan halaman rincian RAB.
 */
export function hitungBepSederhana(
  totalCapex: number,
  labaPerBulan: number,
  paymentType: string | undefined,
): number {
  if (labaPerBulan <= 0) return Infinity;
  const jeda = paymentType === "POSTPAID" ? JEDA_TAGIHAN_PASCABAYAR_BULAN : 0;
  return totalCapex / labaPerBulan + jeda;
}

/**
 * Ringkasan BEP RAB. `bepMonth` = bulan ke-n saat modal investor lunas
 * menurut mesin tracking RAB (sama dengan tabel tracking & bagi hasil),
 * Infinity bila tidak lunas dalam durasi proyek.
 */
export function calculateRealisticBEP(project: RABProject): {
  bepMonth: number;
  simpleBep: number;
  monthsToFullCapacity: number;
  roiPerYear: number;
} {
  const totalCapex = project.items
    .filter((item) => !item.expenseType || item.expenseType === "CAPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);

  const monthlyOpex = Number(project.projectedOpex);
  const arpu = Number(project.arpu) || 0;
  const targetSubscribers = project.targetSubscribers || 0;
  const growthType = project.growthType || "LINEAR";
  const paymentType = project.paymentType || "PREPAID";
  const growthSettings = project.growthSettings;

  const nplTolerancePercent = project.nplTolerancePercent || 0;

  const grossRevenue = Number(project.projectedRevenue);
  const fullRevenue = grossRevenue * (1 - nplTolerancePercent / 100);
  const simpleProfit = fullRevenue - monthlyOpex;

  const simpleBep = hitungBepSederhana(totalCapex, simpleProfit, paymentType);
  const bepMesin =
    buildRABTrackingDataset(project, project.actualAchievements ?? []).totals.bepMonth ?? Infinity;

  if (!targetSubscribers || !arpu || !growthSettings) {
    return {
      bepMonth: bepMesin,
      simpleBep,
      monthsToFullCapacity: 0,
      roiPerYear: 0,
    };
  }

  const maxMonths = 120;
  const monthlySubsTargets = calculateMonthlySubscribers(
    targetSubscribers,
    growthType,
    growthSettings || null,
    maxMonths,
  );

  let monthsToFullCapacity = 0;

  for (let month = 1; month <= maxMonths; month++) {
    const subs = monthlySubsTargets[month - 1];
    if (subs >= targetSubscribers && monthsToFullCapacity === 0) {
      monthsToFullCapacity = month;
    }
  }

  const roiPerYear =
    totalCapex > 0 && simpleProfit > 0
      ? ((simpleProfit * 12) / totalCapex) * 100
      : 0;

  return { bepMonth: bepMesin, simpleBep, monthsToFullCapacity, roiPerYear };
}

/** Dipindah ke modul finance; diekspor ulang untuk pemakai lama. */
export { calculateMonthlySubscribers };
