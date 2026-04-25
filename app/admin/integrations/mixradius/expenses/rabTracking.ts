import { calculateMonthlySubscribers } from "./rabCalculations";
import type { RABActualAchievement, RABProject } from "./rabTypes";

export interface RABTrackingRow {
  month: number;
  targetSubscribers: number;
  billingSubscribers: number;
  grossTargetRevenue: number;
  projectedRevenue: number;
  actualRevenue: number | null;
  displayRevenue: number;
  nplAmount: number;
  grossProfit: number;
  recoveryInstallment: number;
  remainingInvestment: number;
  netProfit: number;
  investorProfitSharePercent: number;
  investorShare: number;
  companyShare: number;
  isAutoAssumed: boolean;
  hasManualRecoveryInstallment: boolean;
  hasManualInvestorShare: boolean;
  hasManualCompanyShare: boolean;
  hasManualInvestorProfitSharePercent: boolean;
  cumulativeRevenue: number;
  cumulativeNplAmount: number;
  cumulativeGrossProfit: number;
  cumulativeRecoveryInstallment: number;
  cumulativeInvestorShare: number;
  cumulativeCompanyShare: number;
}

export interface RABTrackingTotals {
  grossRevenue: number;
  revenue: number;
  nplAmount: number;
  opex: number;
  grossProfit: number;
  recoveryInstallment: number;
  investorShare: number;
  companyShare: number;
  remainingInvestment: number;
  investorTotalReceived: number;
  companyTotalReceived: number;
}

export interface RABTrackingDataset {
  rows: RABTrackingRow[];
  totals: RABTrackingTotals;
}

function toAchievementMap(
  actualAchievements: RABActualAchievement[] = [],
): Map<number, RABActualAchievement> {
  return new Map(
    actualAchievements.map((achievement) => [achievement.month, achievement]),
  );
}

function getCapexTotal(project: RABProject): number {
  return project.items
    .filter((item) => !item.expenseType || item.expenseType === "CAPEX")
    .reduce((sum, item) => sum + Number(item.totalPrice), 0);
}

export function buildRABTrackingDataset(
  project: RABProject,
  actualAchievements: RABActualAchievement[] = [],
): RABTrackingDataset {
  const maxMonthsToShow = project.investmentDurationMonths || 12;
  const nplTolerancePercent = Number(project.nplTolerancePercent || 0);
  const monthlyOpex = Number(project.projectedOpex || 0);
  const arpu = Number(project.arpu || 0);

  const monthlySubsTargets = calculateMonthlySubscribers(
    project.targetSubscribers || 0,
    project.growthType || "LINEAR",
    project.growthSettings || null,
    maxMonthsToShow,
  );

  const achievementByMonth = toAchievementMap(actualAchievements);

  const recoveryType = project.investmentRecoveryType || "PERCENTAGE";
  const recoveryValue = Number(project.investmentRecoveryValue || 50);
  const defaultInvestorSharePercent = Number(
    project.investorProfitSharePercent || 50,
  );

  let remainingInvestment = getCapexTotal(project);

  let cumulativeGrossRevenue = 0;
  let cumulativeRevenue = 0;
  let cumulativeNplAmount = 0;
  let cumulativeOpex = 0;
  let cumulativeGrossProfit = 0;
  let cumulativeRecoveryInstallment = 0;
  let cumulativeInvestorShare = 0;
  let cumulativeCompanyShare = 0;

  const rows: RABTrackingRow[] = Array.from({ length: maxMonthsToShow }).map(
    (_, index) => {
      const month = index + 1;
      const targetSubscribers = monthlySubsTargets[index] || 0;
      const billingSubscribers =
        project.paymentType === "POSTPAID"
          ? monthlySubsTargets[index - 1] || 0
          : targetSubscribers;

      const grossTargetRevenue = billingSubscribers * arpu;
      const projectedRevenue =
        grossTargetRevenue * (1 - nplTolerancePercent / 100);

      const actualRecord = achievementByMonth.get(month);
      const actualRevenue = actualRecord
        ? Number(actualRecord.actualRevenue)
        : null;
      const displayRevenue = actualRevenue ?? projectedRevenue;
      const nplAmount = grossTargetRevenue - projectedRevenue;
      const grossProfit = displayRevenue - monthlyOpex;

      const hasManualRecoveryInstallment =
        actualRecord?.manualRecoveryInstallment !== undefined &&
        actualRecord?.manualRecoveryInstallment !== null;
      let recoveryInstallment = 0;

      if (hasManualRecoveryInstallment) {
        recoveryInstallment = Number(actualRecord?.manualRecoveryInstallment);
      } else if (remainingInvestment > 0 && grossProfit > 0) {
        recoveryInstallment =
          recoveryType === "PERCENTAGE"
            ? (recoveryValue / 100) * grossProfit
            : recoveryValue;
        recoveryInstallment = Math.min(
          recoveryInstallment,
          remainingInvestment,
          grossProfit,
        );
      }

      remainingInvestment -= recoveryInstallment;
      const netProfit = Math.max(0, grossProfit - recoveryInstallment);

      const hasManualInvestorShare =
        actualRecord?.manualInvestorShare !== undefined &&
        actualRecord?.manualInvestorShare !== null;
      const hasManualCompanyShare =
        actualRecord?.manualCompanyShare !== undefined &&
        actualRecord?.manualCompanyShare !== null;
      const hasManualInvestorProfitSharePercent =
        actualRecord?.manualInvestorProfitSharePercent !== undefined &&
        actualRecord?.manualInvestorProfitSharePercent !== null;

      const investorProfitSharePercent = hasManualInvestorProfitSharePercent
        ? Number(actualRecord?.manualInvestorProfitSharePercent)
        : defaultInvestorSharePercent;

      const investorShare = hasManualInvestorShare
        ? Number(actualRecord?.manualInvestorShare)
        : (investorProfitSharePercent / 100) * netProfit;

      const companyShare = hasManualCompanyShare
        ? Number(actualRecord?.manualCompanyShare)
        : netProfit - investorShare;

      cumulativeGrossRevenue += grossTargetRevenue;
      cumulativeRevenue += displayRevenue;
      cumulativeNplAmount += nplAmount;
      cumulativeOpex += monthlyOpex;
      cumulativeGrossProfit += grossProfit;
      cumulativeRecoveryInstallment += recoveryInstallment;
      cumulativeInvestorShare += investorShare;
      cumulativeCompanyShare += companyShare;

      return {
        month,
        targetSubscribers,
        billingSubscribers,
        grossTargetRevenue,
        projectedRevenue,
        actualRevenue,
        displayRevenue,
        nplAmount,
        grossProfit,
        recoveryInstallment,
        remainingInvestment,
        netProfit,
        investorProfitSharePercent,
        investorShare,
        companyShare,
        isAutoAssumed: !actualRecord,
        hasManualRecoveryInstallment,
        hasManualInvestorShare,
        hasManualCompanyShare,
        hasManualInvestorProfitSharePercent,
        cumulativeRevenue,
        cumulativeNplAmount,
        cumulativeGrossProfit,
        cumulativeRecoveryInstallment,
        cumulativeInvestorShare,
        cumulativeCompanyShare,
      };
    },
  );

  return {
    rows,
    totals: {
      grossRevenue: cumulativeGrossRevenue,
      revenue: cumulativeRevenue,
      nplAmount: cumulativeNplAmount,
      opex: cumulativeOpex,
      grossProfit: cumulativeGrossProfit,
      recoveryInstallment: cumulativeRecoveryInstallment,
      investorShare: cumulativeInvestorShare,
      companyShare: cumulativeCompanyShare,
      remainingInvestment,
      investorTotalReceived:
        cumulativeRecoveryInstallment + cumulativeInvestorShare,
      companyTotalReceived: cumulativeCompanyShare,
    },
  };
}
