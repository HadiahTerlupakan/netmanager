import type { RabTargetBasis } from "@/modules/finance";

import type { RABRevisionVarianceLabel } from "./rabRevisionTypes";

export interface RABItem {
  id: string;
  name: string;
  category?: string;
  expenseCategory?: { name: string; parent?: { name: string } };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  expenseType?: "CAPEX" | "OPEX";
  wbsGroupId?: string;
  disbursements?: RABDisbursement[];
}

export interface RABWbs {
  id: string;
  name: string;
  order: number;
}

export interface RABDisbursement {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  estimatedDate?: string;
  isPaid: boolean;
}

export interface LinearGrowthSettings {
  subscribersPerMonth: number;
}

export interface PercentageGrowthSettings {
  initialPercent: number;
  monthlyGrowthPercent: number;
}

export interface CustomMilestone {
  month: number;
  percent: number;
}

export interface CustomGrowthSettings {
  milestones: CustomMilestone[];
}

export type GrowthSettings =
  | LinearGrowthSettings
  | PercentageGrowthSettings
  | CustomGrowthSettings;

export type RABOpexBufferFundingMode =
  | "INVESTOR"
  | "COMPANY"
  | "SHARED_PERCENTAGE"
  | "FIXED";

export type RABInvestorProfitShareMode = "FLAT" | "TIERED_AFTER_BEP";

export interface RABActualAchievement {
  id: string;
  month: number;
  actualSubscribers: number;
  actualRevenue: number;
  manualRecoveryInstallment?: number | null;
  manualInvestorShare?: number | null;
  manualCompanyShare?: number | null;
  manualInvestorProfitSharePercent?: number | null;
  notes?: string;
}

export interface RABApproval {
  id: string;
  rabProjectId: string;
  userId: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: {
      name: string;
    } | null;
  };
}

export interface RABProject {
  id: string;
  name: string;
  description?: string;
  siteId?: string;
  mixRadiusGroupId?: string;
  mixRadiusInvestorSiteId?: string;
  site?: { name: string };
  mixRadiusGroup?: { name: string };
  mixRadiusInvestorSite?: { name: string };
  projectedRevenue: number;
  projectedOpex: number;
  targetBasis?: RabTargetBasis;
  targetHomepass?: number;
  targetTakeUpRatePercent?: number;
  targetSubscribers?: number;
  arpu?: number;
  growthType?: "LINEAR" | "PERCENTAGE" | "CUSTOM";
  paymentType?: "PREPAID" | "POSTPAID";
  growthSettings?: GrowthSettings;
  actualAchievements?: RABActualAchievement[];
  startDate?: string;
  investmentDurationMonths?: number;
  investmentRecoveryType?: "PERCENTAGE" | "FIXED";
  investmentRecoveryValue?: number;
  investorProfitSharePercent?: number;
  investorProfitShareMode?: RABInvestorProfitShareMode;
  investorProfitShareBeforeBepPercent?: number;
  investorProfitShareAfterBepPercent?: number;
  contingencyPercent?: number;
  contingencyAmount?: string | number;
  nplTolerancePercent?: number;
  opexBufferFundingMode?: RABOpexBufferFundingMode;
  opexBufferInvestorPercent?: number;
  opexBufferCompanyPercent?: number;
  opexBufferInvestorFixedAmount?: string | number;
  opexBufferSafetyPercent?: number;
  hasDisbursementPlan?: boolean;
  wbsGroups?: RABWbs[];
  disbursements?: RABDisbursement[];
  status: string;
  items: RABItem[];
  approvals?: RABApproval[];
  finalApprovedRevisionId?: string | null;
  revisionCount?: number;
  latestRevision?: {
    id: string;
    revisionNumber: number;
    status: string;
  } | null;
  revisionProfitLossSummary?: {
    netVariance: string;
    netLabel: RABRevisionVarianceLabel;
  } | null;
  createdAt: string;
  updatedAt: string;
}
