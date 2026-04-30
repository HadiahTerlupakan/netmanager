import type { Prisma, PrismaClient } from "@prisma/client";
import type { RabProjectUpdateInput } from "./rabProject.types";
import {
  getCapexTotal,
  getInvestorFundingBase,
} from "./shared/rabInvestmentCalculator";

const DEFAULT_INVESTOR_PROFIT_SHARE_PERCENT = 50;

type RabProjectTransactionClient = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];

type ProjectWithItems = NonNullable<
  Awaited<ReturnType<RabProjectTransactionClient["rabProject"]["findUnique"]>>
> & { items?: RabProjectUpdateInput["items"] };

interface ProjectFundingChangeInput {
  items: RabProjectUpdateInput["items"];
  projectedOpex: RabProjectUpdateInput["projectedOpex"];
  targetBasis: RabProjectUpdateInput["targetBasis"];
  targetHomepass: RabProjectUpdateInput["targetHomepass"];
  targetTakeUpRatePercent: RabProjectUpdateInput["targetTakeUpRatePercent"];
  targetSubscribers: RabProjectUpdateInput["targetSubscribers"];
  arpu: RabProjectUpdateInput["arpu"];
  growthType: RabProjectUpdateInput["growthType"];
  paymentType: RabProjectUpdateInput["paymentType"];
  growthSettings: RabProjectUpdateInput["growthSettings"];
  investmentDurationMonths: RabProjectUpdateInput["investmentDurationMonths"];
  investorProfitSharePercent: RabProjectUpdateInput["investorProfitSharePercent"];
  nplTolerancePercent: RabProjectUpdateInput["nplTolerancePercent"];
  opexBufferFundingMode: RabProjectUpdateInput["opexBufferFundingMode"];
  opexBufferInvestorPercent: RabProjectUpdateInput["opexBufferInvestorPercent"];
  opexBufferInvestorFixedAmount: RabProjectUpdateInput["opexBufferInvestorFixedAmount"];
  opexBufferSafetyPercent: RabProjectUpdateInput["opexBufferSafetyPercent"];
}

export interface RabInvestmentContext {
  investmentBase: number;
  profitSharePercent: number;
}

export function hasInvestorFundingBaseChange(input: RabProjectUpdateInput) {
  return Object.values(toFundingChangeInput(input)).some(
    (value) => value !== undefined,
  );
}

function toFundingChangeInput(
  input: RabProjectUpdateInput,
): ProjectFundingChangeInput {
  return {
    items: input.items,
    projectedOpex: input.projectedOpex,
    targetBasis: input.targetBasis,
    targetHomepass: input.targetHomepass,
    targetTakeUpRatePercent: input.targetTakeUpRatePercent,
    targetSubscribers: input.targetSubscribers,
    arpu: input.arpu,
    growthType: input.growthType,
    paymentType: input.paymentType,
    growthSettings: input.growthSettings,
    investmentDurationMonths: input.investmentDurationMonths,
    investorProfitSharePercent: input.investorProfitSharePercent,
    nplTolerancePercent: input.nplTolerancePercent,
    opexBufferFundingMode: input.opexBufferFundingMode,
    opexBufferInvestorPercent: input.opexBufferInvestorPercent,
    opexBufferInvestorFixedAmount: input.opexBufferInvestorFixedAmount,
    opexBufferSafetyPercent: input.opexBufferSafetyPercent,
  };
}

export function buildProjectUpdateQuery(
  id: string,
  input: RabProjectUpdateInput,
) {
  return {
    where: { id },
    data: buildProjectUpdateData(input),
  } satisfies Prisma.RabProjectUpdateArgs;
}

function buildProjectUpdateData(input: RabProjectUpdateInput) {
  const data: Prisma.RabProjectUpdateInput = {};
  assignProjectScalars(data, input);
  assignInvestmentScalars(data, input);
  return data;
}

function assignProjectScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.projectedRevenue !== undefined)
    data.projectedRevenue = input.projectedRevenue;
  if (input.projectedOpex !== undefined)
    data.projectedOpex = input.projectedOpex;
  if (input.startDate !== undefined) data.startDate = input.startDate;
  if (input.hasDisbursementPlan !== undefined)
    data.hasDisbursementPlan = input.hasDisbursementPlan;
  assignProjectRelationScalars(data, input);
}

function assignProjectRelationScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.siteId !== undefined) {
    data.site = input.siteId
      ? { connect: { id: input.siteId } }
      : { disconnect: true };
  }
  if (input.mixRadiusGroupId !== undefined)
    data.mixRadiusGroupId = input.mixRadiusGroupId;
  if (input.mixRadiusInvestorSiteId !== undefined)
    data.mixRadiusInvestorSiteId = input.mixRadiusInvestorSiteId;
}

function assignInvestmentScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  assignInvestmentTargetScalars(data, input);
  assignInvestmentRecoveryScalars(data, input);
  assignInvestorProfitScalars(data, input);
  assignOpexBufferScalars(data, input);
}

function assignInvestmentTargetScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.targetBasis !== undefined) data.targetBasis = input.targetBasis;
  if (input.targetHomepass !== undefined)
    data.targetHomepass = input.targetHomepass;
  if (input.targetTakeUpRatePercent !== undefined)
    data.targetTakeUpRatePercent = input.targetTakeUpRatePercent;
  if (input.targetSubscribers !== undefined)
    data.targetSubscribers = input.targetSubscribers;
  if (input.arpu !== undefined) data.arpu = input.arpu;
  if (input.growthType !== undefined) data.growthType = input.growthType;
  if (input.paymentType !== undefined) data.paymentType = input.paymentType;
  if (input.growthSettings !== undefined)
    data.growthSettings = input.growthSettings as Prisma.InputJsonValue;
}

function assignInvestmentRecoveryScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.investmentDurationMonths !== undefined)
    data.investmentDurationMonths = input.investmentDurationMonths;
  if (input.investmentRecoveryType !== undefined)
    data.investmentRecoveryType = input.investmentRecoveryType;
  if (input.investmentRecoveryValue !== undefined)
    data.investmentRecoveryValue = input.investmentRecoveryValue;
}

function assignInvestorProfitScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.investorProfitSharePercent !== undefined)
    data.investorProfitSharePercent = input.investorProfitSharePercent;
  if (input.investorProfitShareMode !== undefined)
    data.investorProfitShareMode = input.investorProfitShareMode;
  if (input.investorProfitShareBeforeBepPercent !== undefined)
    data.investorProfitShareBeforeBepPercent =
      input.investorProfitShareBeforeBepPercent;
  if (input.investorProfitShareAfterBepPercent !== undefined)
    data.investorProfitShareAfterBepPercent =
      input.investorProfitShareAfterBepPercent;
  if (input.contingencyPercent !== undefined)
    data.contingencyPercent = input.contingencyPercent;
  if (input.contingencyAmount !== undefined)
    data.contingencyAmount = input.contingencyAmount;
  if (input.nplTolerancePercent !== undefined)
    data.nplTolerancePercent = input.nplTolerancePercent;
}

function assignOpexBufferScalars(
  data: Prisma.RabProjectUpdateInput,
  input: RabProjectUpdateInput,
) {
  if (input.opexBufferFundingMode !== undefined)
    data.opexBufferFundingMode = input.opexBufferFundingMode;
  if (input.opexBufferInvestorPercent !== undefined)
    data.opexBufferInvestorPercent = input.opexBufferInvestorPercent;
  if (input.opexBufferCompanyPercent !== undefined)
    data.opexBufferCompanyPercent = input.opexBufferCompanyPercent;
  if (input.opexBufferInvestorFixedAmount !== undefined)
    data.opexBufferInvestorFixedAmount = input.opexBufferInvestorFixedAmount;
  if (input.opexBufferSafetyPercent !== undefined)
    data.opexBufferSafetyPercent = input.opexBufferSafetyPercent;
}

export function buildProjectFindQuery(projectId: string) {
  return {
    where: { id: projectId },
    include: { items: true },
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

export function buildUpdatedProjectQuery(projectId: string) {
  return {
    where: { id: projectId },
    include: { items: { include: { disbursements: true } }, wbsGroups: true },
  } satisfies Prisma.RabProjectFindUniqueArgs;
}

export function getInvestmentItems(
  inputItems: RabProjectUpdateInput["items"],
  projectItems: ProjectWithItems["items"],
) {
  return inputItems || projectItems || [];
}

export function buildInvestmentContext(
  input: RabProjectUpdateInput,
  project: ProjectWithItems | null,
  items: ReturnType<typeof getInvestmentItems>,
): RabInvestmentContext {
  const investmentBase = project
    ? getInvestorFundingBase(project, items)
    : getCapexTotal(items);
  const profitSharePercent =
    input.investorProfitSharePercent ??
    project?.investorProfitSharePercent ??
    DEFAULT_INVESTOR_PROFIT_SHARE_PERCENT;
  return { investmentBase, profitSharePercent };
}

export function buildItemCreateData(
  projectId: string,
  item: NonNullable<RabProjectUpdateInput["items"]>[number],
  wbsMap: Map<string, string>,
) {
  assertProjectItemPayload(item);
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

function assertProjectItemPayload(
  item: NonNullable<RabProjectUpdateInput["items"]>[number],
): asserts item is NonNullable<RabProjectUpdateInput["items"]>[number] & {
  name: string;
  quantity: number;
  unitPrice: bigint;
  category: string;
  expenseType: string;
} {
  if (
    item.name &&
    item.quantity !== undefined &&
    item.unitPrice &&
    item.category &&
    item.expenseType
  )
    return;
  throw new Error(
    "Invalid RAB item payload: name, quantity, unitPrice, category, and expenseType are required",
  );
}

export function createDisbursementRows(
  rabItemId: string,
  disbursements: NonNullable<
    NonNullable<RabProjectUpdateInput["items"]>[number]["disbursements"]
  >,
) {
  return disbursements.flatMap((disbursement) => {
    if (!isCompleteDisbursement(disbursement)) return [];
    return [
      {
        rabItemId,
        name: disbursement.name,
        percentage: disbursement.percentage,
        amount: disbursement.amount,
        estimatedDate: disbursement.estimatedDate,
        isPaid: disbursement.isPaid ?? false,
      },
    ];
  });
}

function isCompleteDisbursement(
  disbursement: NonNullable<
    NonNullable<RabProjectUpdateInput["items"]>[number]["disbursements"]
  >[number],
) {
  return (
    disbursement.name !== undefined &&
    disbursement.percentage !== undefined &&
    disbursement.amount !== undefined
  );
}

export function buildInvestorCreateRows(
  projectId: string,
  investorIds: string[],
  amounts: number[],
  profitSharePercent: number,
) {
  return investorIds.map((investorId, index) => ({
    rabProjectId: projectId,
    investorId,
    investmentAmount: BigInt(amounts[index] ?? 0),
    profitSharePercent,
  }));
}
