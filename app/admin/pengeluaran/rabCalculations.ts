import type {
  CustomGrowthSettings,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from "./rabTypes";

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

export function calculateMonthlySubscribers(
  targetSubscribers: number,
  growthType: string,
  growthSettings: GrowthSettings | null,
  months: number,
): number[] {
  const result: number[] = [];
  if (!growthSettings) return Array(months).fill(0);

  for (let month = 1; month <= months; month++) {
    let subs = 0;

    if (growthType === "LINEAR") {
      const settings = growthSettings as LinearGrowthSettings;
      subs = Math.min(settings.subscribersPerMonth * month, targetSubscribers);
    } else if (growthType === "PERCENTAGE") {
      const settings = growthSettings as PercentageGrowthSettings;
      const initialSubs = (settings.initialPercent / 100) * targetSubscribers;
      if (month === 1) {
        subs = initialSubs;
      } else {
        const addPerMonth =
          (settings.monthlyGrowthPercent / 100) * targetSubscribers;
        subs = Math.min(
          initialSubs + addPerMonth * (month - 1),
          targetSubscribers,
        );
      }
    } else if (growthType === "CUSTOM") {
      const settings = growthSettings as CustomGrowthSettings;
      const sortedMilestones = [...settings.milestones].sort(
        (a, b) => a.month - b.month,
      );

      let prevMilestone = { month: 0, percent: 0 };
      let nextMilestone = sortedMilestones[sortedMilestones.length - 1] || {
        month: 1,
        percent: 100,
      };

      for (const m of sortedMilestones) {
        if (m.month <= month) prevMilestone = m;
        if (m.month >= month && m.month < nextMilestone.month)
          nextMilestone = m;
      }

      if (prevMilestone.month === month) {
        subs = (prevMilestone.percent / 100) * targetSubscribers;
      } else if (nextMilestone.month === month) {
        subs = (nextMilestone.percent / 100) * targetSubscribers;
      } else {
        const range = nextMilestone.month - prevMilestone.month;
        const progress = range > 0 ? (month - prevMilestone.month) / range : 0;
        const percentAtMonth =
          prevMilestone.percent +
          (nextMilestone.percent - prevMilestone.percent) * progress;
        subs = (percentAtMonth / 100) * targetSubscribers;
      }
    }
    result.push(Math.round(subs));
  }
  return result;
}
