import type {
  Prisma,
  PrismaClient,
  RabDisbursement,
  RabItem,
  RabProject,
  RabWbs,
} from "@prisma/client";
import type { RabProjectUpdateInput } from "./RabProjectRepository";

type RabInvestmentProjectInput = {
  projectedOpex: bigint;
  targetBasis?: string;
  targetHomepass?: number | null;
  targetTakeUpRatePercent?: number | null;
  targetSubscribers?: number | null;
  arpu?: bigint | null;
  growthType: string;
  paymentType: string;
  growthSettings?: unknown;
  investmentDurationMonths: number;
  nplTolerancePercent: number;
  opexBufferFundingMode: string;
  opexBufferInvestorPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
};

type RabInvestmentItemInput = {
  quantity?: number;
  unitPrice?: bigint;
  expenseType?: string;
};

export class RabProjectUpdateRepository {
  constructor(private readonly client: PrismaClient) {}

  /** Update a RAB project and nested relations in one transaction. */
  async updateProjectWithRelations(
    id: string,
    input: RabProjectUpdateInput,
  ): Promise<
    | (RabProject & {
        items: (RabItem & { disbursements: RabDisbursement[] })[];
        wbsGroups: RabWbs[];
      })
    | null
  > {
    return this.client.$transaction(async (tx) => {
      await tx.rabProject.update({
        where: { id },
        data: this.buildProjectUpdateData(input),
      });
      if (input.items !== undefined) await this.replaceItems(tx, id, input);
      await this.syncInvestors(tx, id, input);
      return this.findUpdatedProject(tx, id);
    });
  }

  private buildProjectUpdateData(input: RabProjectUpdateInput) {
    const data: Prisma.RabProjectUpdateInput = {};
    this.assignProjectScalars(data, input);
    this.assignInvestmentScalars(data, input);
    return data;
  }

  private assignProjectScalars(
    data: Prisma.RabProjectUpdateInput,
    input: RabProjectUpdateInput,
  ) {
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.siteId !== undefined) {
      data.site = input.siteId
        ? { connect: { id: input.siteId } }
        : { disconnect: true };
    }
    if (input.mixRadiusGroupId !== undefined)
      data.mixRadiusGroupId = input.mixRadiusGroupId;
    if (input.mixRadiusInvestorSiteId !== undefined) {
      data.mixRadiusInvestorSiteId = input.mixRadiusInvestorSiteId;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.projectedRevenue !== undefined)
      data.projectedRevenue = input.projectedRevenue;
    if (input.projectedOpex !== undefined)
      data.projectedOpex = input.projectedOpex;
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.hasDisbursementPlan !== undefined)
      data.hasDisbursementPlan = input.hasDisbursementPlan;
  }

  private assignInvestmentScalars(
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
    if (input.investmentDurationMonths !== undefined)
      data.investmentDurationMonths = input.investmentDurationMonths;
    if (input.investmentRecoveryType !== undefined)
      data.investmentRecoveryType = input.investmentRecoveryType;
    if (input.investmentRecoveryValue !== undefined)
      data.investmentRecoveryValue = input.investmentRecoveryValue;
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

  private async replaceItems(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    await tx.rabItem.deleteMany({ where: { rabProjectId: projectId } });
    await tx.rabWbs.deleteMany({ where: { rabProjectId: projectId } });
    const wbsMap = await this.createWbsGroups(
      tx,
      projectId,
      input.wbsGroups || [],
    );
    for (const item of input.items || []) {
      await this.createItemWithDisbursements(tx, projectId, item, wbsMap);
    }
  }

  private async createWbsGroups(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    wbsGroups: NonNullable<RabProjectUpdateInput["wbsGroups"]>,
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

  private async createItemWithDisbursements(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    item: NonNullable<RabProjectUpdateInput["items"]>[number],
    wbsMap: Map<string, string>,
  ) {
    this.assertCompleteItem(item);
    const createdItem = await tx.rabItem.create({
      data: {
        rabProjectId: projectId,
        name: item.name!,
        description: item.description,
        quantity: item.quantity!,
        unitPrice: item.unitPrice!,
        category: item.category!,
        expenseType: item.expenseType!,
        expenseCategoryId: item.expenseCategoryId,
        totalPrice: BigInt(item.quantity!) * item.unitPrice!,
        wbsId: item.wbsGroupId ? wbsMap.get(item.wbsGroupId) : undefined,
      },
    });
    await this.createDisbursements(
      tx,
      createdItem.id,
      item.disbursements || [],
    );
  }

  private assertCompleteItem(
    item: NonNullable<RabProjectUpdateInput["items"]>[number],
  ) {
    if (
      item.name === undefined ||
      item.quantity === undefined ||
      item.unitPrice === undefined ||
      item.category === undefined ||
      item.expenseType === undefined
    ) {
      throw new Error(
        "Invalid RAB item payload: name, quantity, unitPrice, category, and expenseType are required",
      );
    }
  }

  private async createDisbursements(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    rabItemId: string,
    disbursements: NonNullable<
      NonNullable<RabProjectUpdateInput["items"]>[number]["disbursements"]
    >,
  ) {
    const data = disbursements.flatMap((disbursement) => {
      if (
        disbursement.name === undefined ||
        disbursement.percentage === undefined ||
        disbursement.amount === undefined
      ) {
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
    if (data.length > 0) await tx.rabDisbursement.createMany({ data });
  }

  private async syncInvestors(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    if (input.investorIds !== undefined) {
      await this.replaceInvestors(tx, projectId, input);
      return;
    }
    if (hasInvestorFundingBaseChange(input)) {
      await this.recalculateExistingInvestors(tx, projectId, input);
    }
  }

  private async replaceInvestors(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    await tx.rabInvestor.deleteMany({ where: { rabProjectId: projectId } });
    if (!input.investorIds?.length) return;
    const context = await this.getInvestmentContext(tx, projectId, input);
    const amounts = splitInvestmentBase(
      context.investmentBase,
      input.investorIds,
    );
    await tx.rabInvestor.createMany({
      data: input.investorIds.map((investorId, index) => ({
        rabProjectId: projectId,
        investorId,
        investmentAmount: amounts[index],
        profitSharePercent: context.profitSharePercent,
      })),
    });
  }

  private async recalculateExistingInvestors(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    const existingInvestors = await tx.rabInvestor.findMany({
      where: { rabProjectId: projectId },
    });
    if (existingInvestors.length === 0) return;
    const context = await this.getInvestmentContext(tx, projectId, input);
    const investorIds = existingInvestors.map(
      (investor) => investor.investorId,
    );
    const amounts = splitInvestmentBase(context.investmentBase, investorIds);
    for (const [index, investorId] of investorIds.entries()) {
      await tx.rabInvestor.updateMany({
        where: { rabProjectId: projectId, investorId },
        data: {
          investmentAmount: amounts[index],
          profitSharePercent: context.profitSharePercent,
        },
      });
    }
  }

  private async getInvestmentContext(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
    input: RabProjectUpdateInput,
  ) {
    const project = await tx.rabProject.findUnique({
      where: { id: projectId },
      include: { items: true },
    });
    const investmentItems = input.items || project?.items || [];
    const profitSharePercent =
      input.investorProfitSharePercent ??
      project?.investorProfitSharePercent ??
      50;
    const investmentBase = project
      ? getInvestorFundingBase(project, investmentItems)
      : getCapexTotal(investmentItems);
    return { investmentBase, profitSharePercent };
  }

  private findUpdatedProject(
    tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
    projectId: string,
  ) {
    return tx.rabProject.findUnique({
      where: { id: projectId },
      include: { items: { include: { disbursements: true } }, wbsGroups: true },
    });
  }
}

function getCapexTotal(items: RabInvestmentItemInput[]): number {
  return items
    .filter((item) => item.expenseType === "CAPEX")
    .reduce(
      (total, item) =>
        total + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );
}

function getEffectiveTargetSubscribers(
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

function getMonthlySubscribers(project: RabInvestmentProjectInput): number[] {
  const duration = project.investmentDurationMonths;
  const targetSubscribers = getEffectiveTargetSubscribers(project);
  const settings = project.growthSettings as Record<string, unknown> | null;
  if (project.growthType === "PERCENTAGE") {
    const initialPercent = Number(settings?.initialPercent || 0);
    const monthlyGrowthPercent = Number(settings?.monthlyGrowthPercent || 0);
    return Array.from({ length: duration }).map((_, index) => {
      const percent = initialPercent + index * monthlyGrowthPercent;
      return Math.round(
        Math.min(targetSubscribers, targetSubscribers * (percent / 100)),
      );
    });
  }
  if (project.growthType === "CUSTOM") {
    return getCustomGrowthSubscribers(project, targetSubscribers, settings);
  }
  const subscribersPerMonth = Number(settings?.subscribersPerMonth || 0);
  return Array.from({ length: duration }).map((_, index) =>
    Math.min(targetSubscribers, subscribersPerMonth * (index + 1)),
  );
}

function getCustomGrowthSubscribers(
  project: RabInvestmentProjectInput,
  targetSubscribers: number,
  settings: Record<string, unknown> | null,
) {
  const milestones = Array.isArray(settings?.milestones)
    ? (settings.milestones as { month: number; percent: number }[]).sort(
        (a, b) => a.month - b.month,
      )
    : [];
  return Array.from({ length: project.investmentDurationMonths }).map(
    (_, index) =>
      getMilestoneSubscribers(index + 1, milestones, targetSubscribers),
  );
}

function getMilestoneSubscribers(
  month: number,
  milestones: { month: number; percent: number }[],
  targetSubscribers: number,
) {
  let previous = { month: 0, percent: 0 };
  let next = milestones[milestones.length - 1] || { month: 1, percent: 100 };
  for (const milestone of milestones) {
    if (milestone.month <= month) previous = milestone;
    if (milestone.month >= month && milestone.month < next.month)
      next = milestone;
  }
  if (previous.month === month)
    return targetSubscribers * (previous.percent / 100);
  if (next.month === month) return targetSubscribers * (next.percent / 100);
  const range = next.month - previous.month;
  const progress = range > 0 ? (month - previous.month) / range : 0;
  const percent =
    previous.percent + (next.percent - previous.percent) * progress;
  return Math.round(targetSubscribers * (percent / 100));
}

function getOpexBufferInvestorShare(
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
    const revenue = subscribersRevenue(project, billingSubscribers, arpu);
    return total + Math.max(0, monthlyOpex - revenue);
  }, 0);
  const total = gapBase * (1 + project.opexBufferSafetyPercent / 100);
  if (project.opexBufferFundingMode === "COMPANY") return 0;
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

function subscribersRevenue(
  project: RabInvestmentProjectInput,
  subscribers: number,
  arpu: number,
) {
  return subscribers * arpu * (1 - project.nplTolerancePercent / 100);
}

function getInvestorFundingBase(
  project: RabInvestmentProjectInput,
  items: RabInvestmentItemInput[],
): number {
  return getCapexTotal(items) + getOpexBufferInvestorShare(project);
}

function splitInvestmentBase(investmentBase: number, investorIds: string[]) {
  const total = Math.round(investmentBase);
  const baseAmount = Math.floor(total / investorIds.length);
  const remainder = total % investorIds.length;
  return investorIds.map(
    (_, index) => baseAmount + (index < remainder ? 1 : 0),
  );
}

function hasInvestorFundingBaseChange(input: RabProjectUpdateInput): boolean {
  return [
    input.items,
    input.projectedOpex,
    input.targetBasis,
    input.targetHomepass,
    input.targetTakeUpRatePercent,
    input.targetSubscribers,
    input.arpu,
    input.growthType,
    input.paymentType,
    input.growthSettings,
    input.investmentDurationMonths,
    input.investorProfitSharePercent,
    input.nplTolerancePercent,
    input.opexBufferFundingMode,
    input.opexBufferInvestorPercent,
    input.opexBufferInvestorFixedAmount,
    input.opexBufferSafetyPercent,
  ].some((value) => value !== undefined);
}
