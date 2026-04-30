import {
  RabStatus,
  type Prisma,
  type PrismaClient,
  type RabProject,
} from "@prisma/client";
import type {
  RabProjectStatusCandidate,
  RabProjectUpdateInput,
  RabProjectWithDetails,
} from "./rabProject.types";
import {
  buildFullProjectCreateData,
  createProjectInvestors,
  createProjectItems,
  createProjectWbsGroups,
} from "./rabProject.create-helpers";

const DEFAULT_DUPLICATE_PROJECT_STATUS = RabStatus.DRAFT;
const PROJECT_ITEM_INCLUDE = { include: { disbursements: true } };
const PROJECT_DETAIL_REVISION_SELECT = {
  id: true,
  revisionNumber: true,
  status: true,
};
const PROJECT_DETAIL_COUNT_SELECT = { revisions: true };
const PROJECT_DETAIL_INCLUDE = {
  items: PROJECT_ITEM_INCLUDE,
  wbsGroups: true,
  actualAchievements: { orderBy: [{ year: "asc" }, { month: "asc" }] },
  site: { select: { name: true } },
  creator: { select: { name: true } },
  investors: true,
  revisions: {
    select: PROJECT_DETAIL_REVISION_SELECT,
    orderBy: { revisionNumber: "desc" },
    take: 1,
  },
  _count: { select: PROJECT_DETAIL_COUNT_SELECT },
} satisfies Prisma.RabProjectInclude;
const PROJECT_LIST_INCLUDE = {
  items: {
    orderBy: [{ wbsId: "asc" }, { id: "asc" }],
    include: {
      disbursements: { orderBy: [{ estimatedDate: "asc" }, { id: "asc" }] },
      expenseCategory: { include: { parent: true } },
    },
  },
  wbsGroups: { orderBy: [{ order: "asc" }, { id: "asc" }] },
  site: { select: { name: true } },
  investors: { orderBy: { id: "asc" } },
  creator: { select: { name: true } },
  approvals: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: { select: { name: true } },
        },
      },
    },
  },
  revisions: {
    select: PROJECT_DETAIL_REVISION_SELECT,
    orderBy: { revisionNumber: "desc" },
    take: 1,
  },
  _count: { select: PROJECT_DETAIL_COUNT_SELECT },
} satisfies Prisma.RabProjectInclude;
const PROJECT_STATUS_EVALUATION_INCLUDE = {
  actualAchievements: { orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.RabProjectInclude;
const PROJECT_STATUS_EVALUATION_WHERE = {
  status: { in: ["PENJUALAN", "TARGET_TERCAPAI"] },
} satisfies Prisma.RabProjectWhereInput;
const PROJECT_LIST_ORDER_BY = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
] satisfies Prisma.RabProjectOrderByWithRelationInput[];
const DUPLICATE_ITEM_INCLUDE = {
  items: true,
} satisfies Prisma.RabProjectInclude;
const REVISION_PROFIT_LOSS_INCLUDE = {
  items: true,
  finalApprovedRevision: {
    include: { items: { orderBy: { sortOrder: "asc" } } },
  },
} satisfies Prisma.RabProjectInclude;
const FULL_PROJECT_RESULT_INCLUDE = {
  items: PROJECT_ITEM_INCLUDE,
  wbsGroups: true,
} satisfies Prisma.RabProjectInclude;
export interface FullProjectCreateInput {
  project: {
    name: string;
    description?: string;
    siteId?: string | null;
    mixRadiusGroupId?: string | null;
    mixRadiusInvestorSiteId?: string | null;
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

/** Builds a status update payload for simple project transitions. */
export function createStatusUpdateData(status: RabStatus) {
  return {
    status,
    updatedAt: new Date(),
  } satisfies Prisma.RabProjectUpdateInput;
}

/** Builds query args for project status evaluation. */
export function createProjectStatusEvaluationQuery() {
  return {
    where: PROJECT_STATUS_EVALUATION_WHERE,
    include: PROJECT_STATUS_EVALUATION_INCLUDE,
  } satisfies Prisma.RabProjectFindManyArgs;
}

/** Builds query args for detailed project list responses. */
export function createProjectListQuery(where: Prisma.RabProjectWhereInput) {
  return {
    where,
    orderBy: PROJECT_LIST_ORDER_BY,
    include: PROJECT_LIST_INCLUDE,
  } satisfies Prisma.RabProjectFindManyArgs;
}

/** Builds query args for project detail responses. */
export function createProjectDetailQuery(id: string) {
  return {
    where: { id },
    include: PROJECT_DETAIL_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for project item detail responses. */
export function createProjectWithItemsQuery(id: string) {
  return {
    where: { id },
    include: { items: PROJECT_ITEM_INCLUDE, wbsGroups: true },
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for revision profit-loss analysis. */
export function createRevisionProfitLossQuery(id: string) {
  return {
    where: { id },
    include: REVISION_PROFIT_LOSS_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds query args for project duplication source lookup. */
export function createProjectDuplicateQuery(id: string) {
  return {
    where: { id },
    include: DUPLICATE_ITEM_INCLUDE,
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds a minimal project lookup query by id. */
export function createBasicProjectQuery(id: string) {
  return { where: { id } } satisfies Prisma.RabProjectFindUniqueArgs;
}

/** Builds delete transaction steps for draft project removal. */
export function createDraftProjectDeleteTransaction(
  client: PrismaClient,
  id: string,
) {
  return [
    client.rabInvestor.deleteMany({ where: { rabProjectId: id } }),
    client.expense.updateMany({
      where: { rabProjectId: id },
      data: { rabProjectId: null },
    }),
    client.rabProject.delete({ where: { id } }),
  ] as const;
}

/** Builds the upsert payload for actual achievement rows. */
export function buildActualAchievementUpsertArgs(input: {
  rabProjectId: string;
  month: number;
  year: number;
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
}) {
  return {
    where: createActualAchievementWhere(input),
    create: input,
    update: createActualAchievementUpdate(input),
  };
}

function createActualAchievementWhere(input: {
  rabProjectId: string;
  month: number;
  year: number;
}) {
  return {
    rabProjectId_month_year: {
      rabProjectId: input.rabProjectId,
      month: input.month,
      year: input.year,
    },
  };
}

function createActualAchievementUpdate(input: {
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
}) {
  return {
    actualSubscribers: input.actualSubscribers,
    actualRevenue: input.actualRevenue,
    actualOpex: input.actualOpex,
    manualRecoveryInstallment: input.manualRecoveryInstallment,
    manualInvestorShare: input.manualInvestorShare,
    manualCompanyShare: input.manualCompanyShare,
    manualInvestorProfitSharePercent: input.manualInvestorProfitSharePercent,
    notes: input.notes,
  };
}

/** Creates a full project inside an open Prisma transaction. */
export async function createFullProjectInTransaction(
  tx: TransactionClient,
  data: FullProjectCreateInput,
) {
  const project = await tx.rabProject.create({
    data: buildFullProjectCreateData(data),
  });
  const wbsMap = await createProjectWbsGroups(tx, project.id, data.wbsGroups);

  if (data.items.length > 0) {
    await createProjectItems({
      tx,
      projectId: project.id,
      items: data.items,
      wbsMap,
    });
  }

  if (data.investorIds.length > 0) {
    await createProjectInvestors(tx, project.id, data);
  }

  return tx.rabProject.findUnique({
    where: { id: project.id },
    include: FULL_PROJECT_RESULT_INCLUDE,
  }) as Promise<RabProjectWithDetails | null>;
}

/** Normalizes duplicated project creation args from a source project. */
export function buildDuplicateProjectCreateArgs(
  sourceProject: DuplicateProjectSource,
  userId: string,
) {
  return {
    data: createDuplicateProjectData(sourceProject, userId),
    include: DUPLICATE_ITEM_INCLUDE,
  } satisfies Prisma.RabProjectCreateArgs;
}

function createDuplicateProjectData(
  sourceProject: DuplicateProjectSource,
  userId: string,
) {
  return {
    name: `(Copy) ${sourceProject.name}`,
    description: sourceProject.description,
    site: { connect: { id: sourceProject.siteId } },
    mixRadiusGroupId: sourceProject.mixRadiusGroupId,
    projectedRevenue: sourceProject.projectedRevenue,
    projectedOpex: sourceProject.projectedOpex,
    targetSubscribers: sourceProject.targetSubscribers,
    arpu: sourceProject.arpu,
    growthType: sourceProject.growthType,
    paymentType: sourceProject.paymentType,
    growthSettings: sourceProject.growthSettings as Prisma.InputJsonValue,
    startDate: sourceProject.startDate,
    investmentDurationMonths: sourceProject.investmentDurationMonths,
    investmentRecoveryType: sourceProject.investmentRecoveryType,
    investmentRecoveryValue: sourceProject.investmentRecoveryValue,
    investorProfitSharePercent: sourceProject.investorProfitSharePercent,
    investorProfitShareMode: sourceProject.investorProfitShareMode,
    investorProfitShareBeforeBepPercent:
      sourceProject.investorProfitShareBeforeBepPercent,
    investorProfitShareAfterBepPercent:
      sourceProject.investorProfitShareAfterBepPercent,
    nplTolerancePercent: sourceProject.nplTolerancePercent,
    status: DEFAULT_DUPLICATE_PROJECT_STATUS,
    creator: { connect: { id: userId } },
    items: { create: createDuplicateProjectItems(sourceProject) },
  };
}

function createDuplicateProjectItems(sourceProject: DuplicateProjectSource) {
  return sourceProject.items.map((item) => ({
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    category: item.category,
    expenseType: item.expenseType,
  }));
}

export type {
  RabProjectStatusCandidate,
  RabProjectWithDetails,
  RabProject,
  DuplicateProjectSource,
};
