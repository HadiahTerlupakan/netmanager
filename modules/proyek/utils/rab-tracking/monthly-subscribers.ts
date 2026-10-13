import type {
  CustomGrowthSettings,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
} from "./types";

/** Target pelanggan per bulan proyek (bulan ke-1..n) sesuai pola pertumbuhan RAB. */
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
