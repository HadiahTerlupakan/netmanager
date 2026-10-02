import { calculateMonthlySubscribers } from "@/modules/finance/client";
import type { RABProject } from "./rabTypes";

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

  let simpleBep = Infinity;
  if (simpleProfit > 0) {
    if (paymentType === "POSTPAID") {
      simpleBep = (totalCapex + fullRevenue) / simpleProfit;
    } else {
      simpleBep = totalCapex / simpleProfit;
    }
  }

  if (!targetSubscribers || !arpu || !growthSettings) {
    return {
      bepMonth: Infinity,
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

  let cumulativeProfit = 0;
  let bepMonth = Infinity;
  let monthsToFullCapacity = 0;
  let previousMonthSubs = 0;

  for (let month = 1; month <= maxMonths; month++) {
    const subs = monthlySubsTargets[month - 1];
    const billingSubs = paymentType === "POSTPAID" ? previousMonthSubs : subs;
    const grossRev = billingSubs * arpu;
    const revenue = grossRev * (1 - nplTolerancePercent / 100);
    const profit = revenue - monthlyOpex;
    cumulativeProfit += profit;

    if (cumulativeProfit >= totalCapex && bepMonth === Infinity) {
      bepMonth = month;
    }

    if (subs >= targetSubscribers && monthsToFullCapacity === 0) {
      monthsToFullCapacity = month;
    }

    previousMonthSubs = subs;
  }

  const roiPerYear =
    totalCapex > 0 && simpleProfit > 0
      ? ((simpleProfit * 12) / totalCapex) * 100
      : 0;

  return { bepMonth, simpleBep, monthsToFullCapacity, roiPerYear };
}

/** Dipindah ke modul finance; diekspor ulang untuk pemakai lama. */
export { calculateMonthlySubscribers };
