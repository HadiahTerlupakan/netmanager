import type {
  RabExpenseType,
  RabGrowthType,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
} from "@prisma/client";

interface RabInvestmentProjectInput {
  projectedOpex: bigint;
  targetBasis?: RabTargetBasis | string;
  targetHomepass?: number | null;
  targetTakeUpRatePercent?: number | null;
  targetSubscribers?: number | null;
  arpu?: bigint | null;
  growthType: RabGrowthType | string;
  paymentType: RabPaymentType | string;
  growthSettings?: unknown;
  investmentDurationMonths: number;
  nplTolerancePercent: number;
  opexBufferFundingMode: RabOpexBufferFundingMode | string;
  opexBufferInvestorPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
}

interface RabInvestmentItemInput {
  quantity?: number;
  unitPrice?: bigint;
  expenseType?: RabExpenseType | string;
}

interface Milestone {
  month: number;
  percent: number;
}

/** Menghitung total CAPEX dari daftar item investasi. */
export function getCapexTotal(items: RabInvestmentItemInput[]): number {
  return items
    .filter((item) => item.expenseType === "CAPEX")
    .reduce(
      (total, item) =>
        total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
}

/** Menghitung target pelanggan efektif berdasarkan basis target proyek. */
export function getEffectiveTargetSubscribers(
  project: RabInvestmentProjectInput,
): number {
  if (project.targetBasis !== "HOMEPASS") {
    return Number(project.targetSubscribers || 0);
  }

  return Math.round(
    Number(project.targetHomepass || 0) *
      (Number(project.targetTakeUpRatePercent || 0) / 100),
  );
}

/** Menghitung proyeksi subscriber bulanan berdasarkan strategi growth proyek. */
export function getMonthlySubscribers(
  project: RabInvestmentProjectInput,
): number[] {
  const duration = project.investmentDurationMonths;
  const targetSubscribers = getEffectiveTargetSubscribers(project);
  const settings = project.growthSettings as Record<string, unknown> | null;

  if (project.growthType === "PERCENTAGE") {
    return getPercentageGrowthSubscribers(
      duration,
      targetSubscribers,
      settings,
    );
  }

  if (project.growthType === "CUSTOM") {
    return getCustomGrowthSubscribers(duration, targetSubscribers, settings);
  }

  return getFixedGrowthSubscribers(duration, targetSubscribers, settings);
}

function getPercentageGrowthSubscribers(
  duration: number,
  targetSubscribers: number,
  settings: Record<string, unknown> | null,
) {
  const initialPercent = Number(settings?.initialPercent || 0);
  const monthlyGrowthPercent = Number(settings?.monthlyGrowthPercent || 0);

  return Array.from({ length: duration }).map((_, index) => {
    const percent = initialPercent + index * monthlyGrowthPercent;
    return Math.round(
      Math.min(targetSubscribers, targetSubscribers * (percent / 100)),
    );
  });
}

function getCustomGrowthSubscribers(
  duration: number,
  targetSubscribers: number,
  settings: Record<string, unknown> | null,
) {
  const milestones = Array.isArray(settings?.milestones)
    ? (settings.milestones as Milestone[]).sort(
        (left, right) => left.month - right.month,
      )
    : [];

  return Array.from({ length: duration }).map((_, index) =>
    getMilestoneSubscribers(index + 1, milestones, targetSubscribers),
  );
}

function getFixedGrowthSubscribers(
  duration: number,
  targetSubscribers: number,
  settings: Record<string, unknown> | null,
) {
  const subscribersPerMonth = Number(settings?.subscribersPerMonth || 0);

  return Array.from({ length: duration }).map((_, index) =>
    Math.min(targetSubscribers, subscribersPerMonth * (index + 1)),
  );
}

function getMilestoneSubscribers(
  month: number,
  milestones: Milestone[],
  targetSubscribers: number,
) {
  let previous = { month: 0, percent: 0 };
  let next = milestones[milestones.length - 1] || { month: 1, percent: 100 };

  for (const milestone of milestones) {
    if (milestone.month <= month) {
      previous = milestone;
    }

    if (milestone.month >= month && milestone.month < next.month) {
      next = milestone;
    }
  }

  if (previous.month === month) {
    return targetSubscribers * (previous.percent / 100);
  }

  if (next.month === month) {
    return targetSubscribers * (next.percent / 100);
  }

  const range = next.month - previous.month;
  const progress = range > 0 ? (month - previous.month) / range : 0;
  const percent =
    previous.percent + (next.percent - previous.percent) * progress;

  return Math.round(targetSubscribers * (percent / 100));
}

/** Menghitung porsi buffer OPEX yang harus ditanggung investor. */
export function getOpexBufferInvestorShare(
  project: RabInvestmentProjectInput,
): number {
  const arpu = Number(project.arpu || 0);
  const monthlyOpex = Number(project.projectedOpex);
  const monthlySubscribers = getMonthlySubscribers(project);
  const gapBase = monthlySubscribers.reduce((total, subscribers, index) => {
    const billingSubscribers =
      project.paymentType === "POSTPAID"
        ? monthlySubscribers[index - 1] || 0
        : subscribers;
    const revenue = getSubscriberRevenue(project, billingSubscribers, arpu);

    return total + Math.max(0, monthlyOpex - revenue);
  }, 0);
  const total = gapBase * (1 + project.opexBufferSafetyPercent / 100);

  if (project.opexBufferFundingMode === "COMPANY") {
    return 0;
  }

  if (project.opexBufferFundingMode === "FIXED") {
    return Math.min(
      Math.max(0, Number(project.opexBufferInvestorFixedAmount)),
      total,
    );
  }

  if (project.opexBufferFundingMode === "SHARED_PERCENTAGE") {
    return Math.min(
      Math.max(0, total * (project.opexBufferInvestorPercent / 100)),
      total,
    );
  }

  return total;
}

function getSubscriberRevenue(
  project: RabInvestmentProjectInput,
  subscribers: number,
  arpu: number,
) {
  return subscribers * arpu * (1 - project.nplTolerancePercent / 100);
}

/** Menghitung basis pendanaan investor dari CAPEX dan buffer OPEX. */
export function getInvestorFundingBase(
  project: RabInvestmentProjectInput,
  items: RabInvestmentItemInput[],
): number {
  return getCapexTotal(items) + getOpexBufferInvestorShare(project);
}

/** Membagi basis investasi secara merata ke seluruh investor. */
export function splitInvestmentBase(
  investmentBase: number,
  investorIds: string[],
): number[] {
  const total = Math.round(investmentBase);
  const baseAmount = Math.floor(total / investorIds.length);
  const remainder = total % investorIds.length;

  return investorIds.map(
    (_, index) => baseAmount + (index < remainder ? 1 : 0),
  );
}
