import type { Prisma } from "@prisma/client";
import type { RabProjectUpdateInput } from "./rabProject.types";

export {
  buildInvestmentContext,
  buildInvestorCreateRows,
  buildItemCreateData,
  createDisbursementRows,
  getInvestmentItems,
} from "./rabProject.update-row-helpers";
export type { RabInvestmentContext } from "./rabProject.update-row-helpers";

export function hasInvestorFundingBaseChange(input: RabProjectUpdateInput) {
  return Object.values(toFundingChangeInput(input)).some(
    (value) => value !== undefined,
  );
}

function toFundingChangeInput(
  input: RabProjectUpdateInput,
): Record<string, unknown> {
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
