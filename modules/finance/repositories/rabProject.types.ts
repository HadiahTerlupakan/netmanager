import type {
  RabDisbursement,
  RabExpenseType,
  RabGrowthType,
  RabInvestor,
  RabInvestorProfitShareMode,
  RabItem,
  RabItemCategory,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabProject,
  RabRecoveryType,
  RabStatus,
  RabTargetBasis,
  RabWbs,
} from "@prisma/client";

export interface RabProjectWithDetails extends RabProject {
  items?: (RabItem & { disbursements?: RabDisbursement[] })[];
  wbsGroups?: RabWbs[];
  site?: { name: string } | null;
  investors?: RabInvestor[];
  creator?: { name: string } | null;
  approvals?: unknown[];
  revisions?: { id: string; revisionNumber: number; status: string }[];
  _count?: { revisions: number };
}

export interface RabDisbursementUpdateInput {
  id?: string;
  name?: string;
  percentage?: number;
  amount?: bigint;
  estimatedDate?: Date;
  isPaid?: boolean;
}

export interface RabItemUpdateInput {
  name?: string;
  description?: string;
  quantity?: number;
  unitPrice?: bigint;
  category?: RabItemCategory;
  expenseType?: RabExpenseType;
  expenseCategoryId?: string;
  wbsGroupId?: string;
  disbursements?: RabDisbursementUpdateInput[];
}

export interface RabWbsUpdateInput {
  id?: string;
  name: string;
  order: number;
}

export interface RabProjectStatusCandidate {
  id: string;
  name: string;
  status: RabStatus;
  startDate: Date | null;
  investmentDurationMonths: number | null;
  targetSubscribers: number | null;
  actualAchievements?: Array<{
    actualSubscribers: number;
    createdAt: Date;
  }>;
}

export interface RabProjectUpdateInput {
  name?: string;
  description?: string;
  siteId?: string | null;
  mixRadiusGroupId?: string | null;
  mixRadiusInvestorSiteId?: string | null;
  status?: RabStatus;
  projectedRevenue?: bigint;
  projectedOpex?: bigint;
  targetBasis?: RabTargetBasis;
  targetHomepass?: number;
  targetTakeUpRatePercent?: number;
  targetSubscribers?: number;
  arpu?: bigint;
  growthType?: RabGrowthType;
  paymentType?: RabPaymentType;
  growthSettings?: unknown;
  startDate?: Date;
  investmentDurationMonths?: number;
  investmentRecoveryType?: RabRecoveryType;
  investmentRecoveryValue?: number;
  investorProfitSharePercent?: number;
  investorProfitShareMode?: RabInvestorProfitShareMode;
  investorProfitShareBeforeBepPercent?: number;
  investorProfitShareAfterBepPercent?: number;
  contingencyPercent?: number;
  contingencyAmount?: bigint;
  nplTolerancePercent?: number;
  opexBufferFundingMode?: RabOpexBufferFundingMode;
  opexBufferInvestorPercent?: number;
  opexBufferCompanyPercent?: number;
  opexBufferInvestorFixedAmount?: bigint;
  opexBufferSafetyPercent?: number;
  hasDisbursementPlan?: boolean;
  wbsGroups?: RabWbsUpdateInput[];
  investorIds?: string[];
  items?: RabItemUpdateInput[];
}
