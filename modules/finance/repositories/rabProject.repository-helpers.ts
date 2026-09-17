import type { Prisma, PrismaClient, RabProject } from "@prisma/client";
import type {
  RabProjectStatusCandidate,
  RabProjectUpdateInput,
  RabProjectWithDetails,
} from "./rabProject.types";

export {
  buildActualAchievementUpsertArgs,
  buildDuplicateProjectCreateArgs,
  createDraftProjectDeleteTransaction,
  createFullProjectInTransaction,
} from "./rabProject.repository-mutations";
export {
  createBasicProjectQuery,
  createProjectDetailQuery,
  createProjectDuplicateQuery,
  createProjectListQuery,
  createProjectStatusEvaluationQuery,
  createProjectWithItemsQuery,
  createRevisionProfitLossQuery,
  createStatusUpdateData,
} from "./rabProject.repository-queries";

export interface FullProjectCreateInput {
  project: {
    name: string;
    description?: string;
    siteId?: string | null;
    projectedRevenue: bigint;
    projectedOpex: bigint;
    targetBasis?: RabProjectUpdateInput["targetBasis"];
    targetHomepass?: number;
    targetTakeUpRatePercent?: number;
    targetSubscribers?: number;
    arpu?: bigint;
    growthType: string;
    paymentType: string;
    growthSettings?: unknown;
    startDate?: Date;
    investmentDurationMonths: number;
    investmentRecoveryType: string;
    investmentRecoveryValue: number;
    investorProfitSharePercent: number;
    investorProfitShareMode?: RabProjectUpdateInput["investorProfitShareMode"];
    investorProfitShareBeforeBepPercent?: number;
    investorProfitShareAfterBepPercent?: number;
    contingencyPercent: number;
    contingencyAmount: bigint;
    nplTolerancePercent: number;
    opexBufferFundingMode: NonNullable<
      RabProjectUpdateInput["opexBufferFundingMode"]
    >;
    opexBufferInvestorPercent: number;
    opexBufferCompanyPercent: number;
    opexBufferInvestorFixedAmount: bigint;
    opexBufferSafetyPercent: number;
    hasDisbursementPlan: boolean;
    createdBy: string;
  };
  wbsGroups: Array<{ id?: string; name: string; order: number }>;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: bigint;
    category: NonNullable<RabProjectUpdateInput["items"]>[number]["category"];
    expenseType: NonNullable<
      RabProjectUpdateInput["items"]
    >[number]["expenseType"];
    expenseCategoryId?: string;
    wbsGroupId?: string;
    disbursements: Array<{
      name: string;
      percentage: number;
      amount: bigint;
      estimatedDate?: Date;
      isPaid: boolean;
    }>;
  }>;
  investorIds: string[];
  investorProfitSharePercent: number;
}

type DuplicateProjectSource = NonNullable<
  Awaited<ReturnType<PrismaClient["rabProject"]["findUnique"]>>
> & {
  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unitPrice: bigint;
    totalPrice: bigint;
    category: Prisma.RabItemUncheckedCreateWithoutRabProjectInput["category"];
    expenseType: Prisma.RabItemUncheckedCreateWithoutRabProjectInput["expenseType"];
  }>;
};

export type TransactionClient = Prisma.TransactionClient;

export type {
  RabProjectStatusCandidate,
  RabProjectWithDetails,
  RabProject,
  DuplicateProjectSource,
};
