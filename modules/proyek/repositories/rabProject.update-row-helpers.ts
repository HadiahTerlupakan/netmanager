import type { RabProjectUpdateInput } from "./rabProject.types";
import {
  getCapexTotal,
  getInvestorFundingBase,
} from "./shared/rabInvestmentCalculator";

const DEFAULT_INVESTOR_PROFIT_SHARE_PERCENT = 50;

type ProjectWithItems = {
  projectedOpex: bigint;
  targetBasis?: RabProjectUpdateInput["targetBasis"];
  targetHomepass?: RabProjectUpdateInput["targetHomepass"];
  targetTakeUpRatePercent?: RabProjectUpdateInput["targetTakeUpRatePercent"];
  targetSubscribers?: RabProjectUpdateInput["targetSubscribers"];
  arpu?: RabProjectUpdateInput["arpu"];
  growthType: NonNullable<RabProjectUpdateInput["growthType"]>;
  paymentType: NonNullable<RabProjectUpdateInput["paymentType"]>;
  growthSettings?: RabProjectUpdateInput["growthSettings"];
  investmentDurationMonths: number;
  investorProfitSharePercent?: number | null;
  nplTolerancePercent: number;
  opexBufferFundingMode: NonNullable<
    RabProjectUpdateInput["opexBufferFundingMode"]
  >;
  opexBufferInvestorPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
  items?: RabProjectUpdateInput["items"];
};

export interface RabInvestmentContext {
  investmentBase: number;
  profitSharePercent: number;
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

export function createDisbursementRows(
  rabItemId: string,
  disbursements: NonNullable<
    NonNullable<RabProjectUpdateInput["items"]>[number]["disbursements"]
  >,
) {
  return disbursements.flatMap((disbursement) => {
    if (!isCompleteDisbursement(disbursement)) {
      return [];
    }

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
  ) {
    return;
  }

  throw new Error(
    "Invalid RAB item payload: name, quantity, unitPrice, category, and expenseType are required",
  );
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
