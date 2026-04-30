import type { Prisma } from "@prisma/client";
import type {
  FullProjectCreateInput,
  TransactionClient,
} from "./rabProject.repository-helpers";
import {
  getInvestorFundingBase,
  splitInvestmentBase,
} from "./shared/rabInvestmentCalculator";

const FULL_PROJECT_DEFAULTS: Partial<FullProjectCreateInput["project"]> = {
  targetBasis: undefined,
  targetHomepass: undefined,
  targetTakeUpRatePercent: undefined,
  targetSubscribers: undefined,
  arpu: undefined,
  growthSettings: undefined,
  startDate: undefined,
  investorProfitShareMode: undefined,
  investorProfitShareBeforeBepPercent: undefined,
  investorProfitShareAfterBepPercent: undefined,
};

interface ProjectItemsInput {
  tx: TransactionClient;
  projectId: string;
  items: FullProjectCreateInput["items"];
  wbsMap: Map<string, string>;
}

export function buildFullProjectCreateData(data: FullProjectCreateInput) {
  return {
    ...buildFullProjectBaseData(data),
    ...buildFullProjectInvestmentData(data),
    ...buildFullProjectProfitData(data),
    ...buildFullProjectBufferData(data),
  } satisfies Prisma.RabProjectUncheckedCreateInput;
}

function buildFullProjectBaseData(data: FullProjectCreateInput) {
  return {
    name: data.project.name,
    description: data.project.description,
    siteId: data.project.siteId,
    mixRadiusGroupId: data.project.mixRadiusGroupId,
    mixRadiusInvestorSiteId: data.project.mixRadiusInvestorSiteId,
    projectedRevenue: data.project.projectedRevenue,
    projectedOpex: data.project.projectedOpex,
    growthType: data.project.growthType as never,
    paymentType: data.project.paymentType as never,
    hasDisbursementPlan: data.project.hasDisbursementPlan,
    createdBy: data.project.createdBy,
  };
}

function buildFullProjectInvestmentData(data: FullProjectCreateInput) {
  return {
    targetBasis: data.project.targetBasis ?? FULL_PROJECT_DEFAULTS.targetBasis,
    targetHomepass:
      data.project.targetHomepass ?? FULL_PROJECT_DEFAULTS.targetHomepass,
    targetTakeUpRatePercent:
      data.project.targetTakeUpRatePercent ??
      FULL_PROJECT_DEFAULTS.targetTakeUpRatePercent,
    targetSubscribers:
      data.project.targetSubscribers ?? FULL_PROJECT_DEFAULTS.targetSubscribers,
    arpu: data.project.arpu ?? FULL_PROJECT_DEFAULTS.arpu,
    growthSettings: (data.project.growthSettings ||
      FULL_PROJECT_DEFAULTS.growthSettings) as
      | Prisma.InputJsonValue
      | undefined,
    startDate: data.project.startDate ?? FULL_PROJECT_DEFAULTS.startDate,
    investmentDurationMonths: data.project.investmentDurationMonths,
    investmentRecoveryType: data.project.investmentRecoveryType as never,
    investmentRecoveryValue: data.project.investmentRecoveryValue,
  };
}

function buildFullProjectProfitData(data: FullProjectCreateInput) {
  return {
    investorProfitSharePercent: data.project.investorProfitSharePercent,
    investorProfitShareMode:
      data.project.investorProfitShareMode ??
      FULL_PROJECT_DEFAULTS.investorProfitShareMode,
    investorProfitShareBeforeBepPercent:
      data.project.investorProfitShareBeforeBepPercent ??
      FULL_PROJECT_DEFAULTS.investorProfitShareBeforeBepPercent,
    investorProfitShareAfterBepPercent:
      data.project.investorProfitShareAfterBepPercent ??
      FULL_PROJECT_DEFAULTS.investorProfitShareAfterBepPercent,
    contingencyPercent: data.project.contingencyPercent,
    contingencyAmount: data.project.contingencyAmount,
    nplTolerancePercent: data.project.nplTolerancePercent,
  };
}

function buildFullProjectBufferData(data: FullProjectCreateInput) {
  return {
    opexBufferFundingMode: data.project.opexBufferFundingMode,
    opexBufferInvestorPercent: data.project.opexBufferInvestorPercent,
    opexBufferCompanyPercent: data.project.opexBufferCompanyPercent,
    opexBufferInvestorFixedAmount: data.project.opexBufferInvestorFixedAmount,
    opexBufferSafetyPercent: data.project.opexBufferSafetyPercent,
  };
}

export async function createProjectWbsGroups(
  tx: TransactionClient,
  projectId: string,
  wbsGroups: FullProjectCreateInput["wbsGroups"],
) {
  const wbsMap = new Map<string, string>();
  for (const wbs of wbsGroups) {
    const createdWbs = await tx.rabWbs.create({
      data: { rabProjectId: projectId, name: wbs.name, order: wbs.order },
    });
    if (wbs.id) wbsMap.set(wbs.id, createdWbs.id);
  }
  return wbsMap;
}

export async function createProjectItems(input: ProjectItemsInput) {
  for (const item of input.items) {
    await createProjectItem(input, item);
  }
}

async function createProjectItem(
  input: ProjectItemsInput,
  item: FullProjectCreateInput["items"][number],
) {
  const createdItem = await input.tx.rabItem.create({
    data: buildProjectItemCreateData(input.projectId, item, input.wbsMap),
  });
  await createProjectDisbursements(
    input.tx,
    createdItem.id,
    item.disbursements,
  );
}

function buildProjectItemCreateData(
  projectId: string,
  item: FullProjectCreateInput["items"][number],
  wbsMap: Map<string, string>,
) {
  return {
    rabProjectId: projectId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    category: item.category,
    expenseType: item.expenseType,
    expenseCategoryId: item.expenseCategoryId,
    totalPrice: BigInt(item.quantity) * item.unitPrice,
    wbsId: item.wbsGroupId ? wbsMap.get(item.wbsGroupId) : undefined,
  };
}

async function createProjectDisbursements(
  tx: TransactionClient,
  rabItemId: string,
  disbursements: FullProjectCreateInput["items"][number]["disbursements"],
) {
  if (disbursements.length === 0) return;
  await tx.rabDisbursement.createMany({
    data: disbursements.map((disbursement) => ({
      rabItemId,
      name: disbursement.name,
      percentage: disbursement.percentage,
      amount: disbursement.amount,
      estimatedDate: disbursement.estimatedDate,
      isPaid: disbursement.isPaid,
    })),
  });
}

export async function createProjectInvestors(
  tx: TransactionClient,
  projectId: string,
  data: FullProjectCreateInput,
) {
  const investmentBase = getInvestorFundingBase(data.project, data.items);
  const amounts = splitInvestmentBase(investmentBase, data.investorIds);
  await tx.rabInvestor.createMany({
    data: data.investorIds.map((investorId, index) => ({
      rabProjectId: projectId,
      investorId,
      investmentAmount: amounts[index],
      profitSharePercent: data.project.investorProfitSharePercent,
    })),
  });
}
