export { buildDailyExpenseIndicators } from "./utils/daily-expense-indicators";
export {
  calculateEffectiveRabTargetSubscribers,
  calculateRabProjectedRevenue,
  calculateRabUnitCosts,
  getRabTargetBasisLabel,
} from "./utils/rabTarget";
export type { RabTargetBasis } from "./utils/rabTarget";

// Mesin tracking RAB (murni) — dipakai UI admin RAB & perhitungan bagi hasil investor.
export {
  buildRABTrackingDataset,
  calculateMonthlySubscribers,
  getInvestorProfitSharePercent,
  PERSEN_BAGI_HASIL_RAB_BAWAAN,
} from "./utils/rab-tracking";
export type {
  CustomGrowthSettings,
  CustomMilestone,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABInvestorProfitShareMode,
  RABOpexBufferFundingMode,
  RABTrackingDataset,
  RABTrackingRow,
  RABTrackingTotals,
  RabTrackingAchievement,
  RabTrackingItem,
  RabTrackingProject,
} from "./utils/rab-tracking";
