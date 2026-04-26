import { calculateMonthlySubscribers } from "./rabCalculations";
import type {
  RABActualAchievement,
  RABOpexBufferFundingMode,
  RABProject,
} from "./rabTypes";

export interface RABTrackingRow {
  month: number;
  targetSubscribers: number;
  billingSubscribers: number;
  grossTargetRevenue: number;
  projectedRevenue: number;
  actualRevenue: number | null;
  displayRevenue: number;
  nplAmount: number;
  opexGap: number;
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
  opexBufferBase: number;
  opexBufferSafety: number;
  opexBufferTotal: number;
  opexBufferInvestorShare: number;
  opexBufferCompanyShare: number;
  opexBufferDurationMonths: number;
  opexBufferCoveredMonths: number[];
  opexBufferDurationLabel: string;
  initialFundingNeed: number;
  investorDepositTotal: number;
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

function getOpexBufferSafety(project: RABProject, baseAmount: number): number {
  return baseAmount * (Number(project.opexBufferSafetyPercent || 0) / 100);
}

function clampBufferAmount(value: number, total: number): number {
  return Math.min(Math.max(0, value), total);
}

function splitOpexBufferFunding(project: RABProject, total: number) {
  const mode: RABOpexBufferFundingMode =
    project.opexBufferFundingMode || "INVESTOR";

  if (mode === "COMPANY") {
    return { investorShare: 0, companyShare: total };
  }

  if (mode === "SHARED_PERCENTAGE") {
    const investorPercent = Number(project.opexBufferInvestorPercent || 0);
    const investorShare = clampBufferAmount(
      (total * investorPercent) / 100,
      total,
    );
    return { investorShare, companyShare: total - investorShare };
  }

  if (mode === "FIXED") {
    const investorShare = clampBufferAmount(
      Number(project.opexBufferInvestorFixedAmount || 0),
      total,
    );
    return { investorShare, companyShare: total - investorShare };
  }

  return { investorShare: total, companyShare: 0 };
}

function getOpexBufferCoveredMonths(gaps: number[]): number[] {
  return gaps
    .map((gap, index) => (gap > 0 ? index + 1 : null))
    .filter((month): month is number => month !== null);
}

function getOpexBufferDurationLabel(coveredMonths: number[]): string {
  if (coveredMonths.length === 0) {
    return "Tidak ada gap OPEX ramp-up yang perlu ditutup buffer";
  }

  return `Buffer menutup gap OPEX selama ${coveredMonths.length} bulan (bulan ke-${coveredMonths.join(", ")})`;
}

function calculateOpexBuffer(project: RABProject, gaps: number[]) {
  const base = gaps.reduce((sum, gap) => sum + gap, 0);
  const safety = getOpexBufferSafety(project, base);
  const total = base + safety;
  const funding = splitOpexBufferFunding(project, total);
  const coveredMonths = getOpexBufferCoveredMonths(gaps);

  return {
    base,
    safety,
    total,
    funding,
    coveredMonths,
    durationLabel: getOpexBufferDurationLabel(coveredMonths),
  };
}

function getBillingSubscribers(
  project: RABProject,
  monthlySubsTargets: number[],
  index: number,
): number {
  return project.paymentType === "POSTPAID"
    ? monthlySubsTargets[index - 1] || 0
    : monthlySubsTargets[index] || 0;
}

function calculateProjectedRevenue(
  billingSubscribers: number,
  arpu: number,
  nplTolerancePercent: number,
): number {
  return billingSubscribers * arpu * (1 - nplTolerancePercent / 100);
}

function calculateOpexGaps(
  project: RABProject,
  monthlySubsTargets: number[],
  achievementByMonth: Map<number, RABActualAchievement>,
): number[] {
  const monthlyOpex = Number(project.projectedOpex || 0);
  const arpu = Number(project.arpu || 0);
  const nplTolerancePercent = Number(project.nplTolerancePercent || 0);

  return monthlySubsTargets.map((_, index) => {
    const billingSubscribers = getBillingSubscribers(
      project,
      monthlySubsTargets,
      index,
    );
    const projectedRevenue = calculateProjectedRevenue(
      billingSubscribers,
      arpu,
      nplTolerancePercent,
    );
    const actualRevenue = achievementByMonth.get(index + 1)?.actualRevenue;
    const displayRevenue = actualRevenue ?? projectedRevenue;

    return Math.max(0, monthlyOpex - Number(displayRevenue));
  });
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

  const opexGaps = calculateOpexGaps(
    project,
    monthlySubsTargets,
    achievementByMonth,
  );
  const opexBuffer = calculateOpexBuffer(project, opexGaps);
  const capexTotal = getCapexTotal(project);
  const initialFundingNeed = capexTotal + opexBuffer.funding.investorShare;
  const investorDepositTotal = initialFundingNeed;
  let remainingInvestment = initialFundingNeed;

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
      const billingSubscribers = getBillingSubscribers(
        project,
        monthlySubsTargets,
        index,
      );

      const grossTargetRevenue = billingSubscribers * arpu;
      const projectedRevenue = calculateProjectedRevenue(
        billingSubscribers,
        arpu,
        nplTolerancePercent,
      );

      const actualRecord = achievementByMonth.get(month);
      const actualRevenue = actualRecord
        ? Number(actualRecord.actualRevenue)
        : null;
      const displayRevenue = actualRevenue ?? projectedRevenue;
      const nplAmount = grossTargetRevenue - projectedRevenue;
      const opexGap = opexGaps[index] || 0;
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
        opexGap,
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
      opexBufferBase: opexBuffer.base,
      opexBufferSafety: opexBuffer.safety,
      opexBufferTotal: opexBuffer.total,
      opexBufferInvestorShare: opexBuffer.funding.investorShare,
      opexBufferCompanyShare: opexBuffer.funding.companyShare,
      opexBufferDurationMonths: opexBuffer.coveredMonths.length,
      opexBufferCoveredMonths: opexBuffer.coveredMonths,
      opexBufferDurationLabel: opexBuffer.durationLabel,
      initialFundingNeed,
      investorDepositTotal,
      investorTotalReceived:
        cumulativeRecoveryInstallment + cumulativeInvestorShare,
      companyTotalReceived: cumulativeCompanyShare,
    },
  };
}
