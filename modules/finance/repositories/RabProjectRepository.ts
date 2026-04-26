import { prisma } from "@/lib/prisma";
import type {
  PrismaClient,
  RabProject,
  RabWbs,
  RabItem,
  RabDisbursement,
  RabInvestor,
} from "@prisma/client";
import type {
  Prisma,
  RabExpenseType,
  RabGrowthType,
  RabInvestorProfitShareMode,
  RabItemCategory,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
  RabRecoveryType,
  RabStatus,
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
  opexBufferFundingMode: RabOpexBufferFundingMode;
  opexBufferInvestorPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
}

interface RabInvestmentItemInput {
  quantity?: number;
  unitPrice?: bigint;
  expenseType?: RabExpenseType | string;
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
    const milestones = Array.isArray(settings?.milestones)
      ? (settings.milestones as { month: number; percent: number }[]).sort(
          (a, b) => a.month - b.month,
        )
      : [];

    return Array.from({ length: duration }).map((_, index) => {
      const month = index + 1;
      let previous = { month: 0, percent: 0 };
      let next = milestones[milestones.length - 1] || {
        month: 1,
        percent: 100,
      };

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
    });
  }

  const subscribersPerMonth = Number(settings?.subscribersPerMonth || 0);
  return Array.from({ length: duration }).map((_, index) =>
    Math.min(targetSubscribers, subscribersPerMonth * (index + 1)),
  );
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
    const revenue =
      billingSubscribers * arpu * (1 - project.nplTolerancePercent / 100);
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

function getInvestorFundingBase(
  project: RabInvestmentProjectInput,
  items: RabInvestmentItemInput[],
): number {
  return getCapexTotal(items) + getOpexBufferInvestorShare(project);
}

function splitInvestmentBase(
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

export class RabProjectRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findManyWithDetails(
    where: Prisma.RabProjectWhereInput,
  ): Promise<RabProjectWithDetails[]> {
    return this.client.rabProject.findMany({
      where,
      include: {
        items: {
          include: {
            disbursements: true,
            expenseCategory: { include: { parent: true } },
          },
        },
        wbsGroups: true,
        site: { select: { name: true } },
        investors: true,
        creator: { select: { name: true } },
        approvals: {
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
          select: { id: true, revisionNumber: true, status: true },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        _count: { select: { revisions: true } },
      },
    }) as Promise<RabProjectWithDetails[]>;
  }

  async createProject(data: Prisma.RabProjectCreateInput): Promise<RabProject> {
    return this.client.rabProject.create({ data });
  }

  async findByIdWithItems(id: string): Promise<
    | (RabProject & {
        items?: (RabItem & { disbursements?: RabDisbursement[] })[];
        wbsGroups?: RabWbs[];
      })
    | null
  > {
    return this.client.rabProject.findUnique({
      where: { id },
      include: {
        items: { include: { disbursements: true } },
        wbsGroups: true,
      },
    });
  }

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
      const updateData: Prisma.RabProjectUpdateInput = {};

      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.siteId !== undefined) {
        updateData.site = input.siteId
          ? { connect: { id: input.siteId } }
          : { disconnect: true };
      }
      if (input.mixRadiusGroupId !== undefined) {
        updateData.mixRadiusGroupId = input.mixRadiusGroupId;
      }
      if (input.mixRadiusInvestorSiteId !== undefined) {
        updateData.mixRadiusInvestorSiteId = input.mixRadiusInvestorSiteId;
      }
      if (input.status !== undefined) updateData.status = input.status;
      if (input.projectedRevenue !== undefined)
        updateData.projectedRevenue = input.projectedRevenue;
      if (input.projectedOpex !== undefined)
        updateData.projectedOpex = input.projectedOpex;
      if (input.targetBasis !== undefined)
        updateData.targetBasis = input.targetBasis;
      if (input.targetHomepass !== undefined)
        updateData.targetHomepass = input.targetHomepass;
      if (input.targetTakeUpRatePercent !== undefined)
        updateData.targetTakeUpRatePercent = input.targetTakeUpRatePercent;
      if (input.targetSubscribers !== undefined)
        updateData.targetSubscribers = input.targetSubscribers;
      if (input.arpu !== undefined) updateData.arpu = input.arpu;
      if (input.growthType !== undefined)
        updateData.growthType = input.growthType;
      if (input.paymentType !== undefined)
        updateData.paymentType = input.paymentType;
      if (input.growthSettings !== undefined)
        updateData.growthSettings =
          input.growthSettings as Prisma.InputJsonValue;
      if (input.startDate !== undefined) updateData.startDate = input.startDate;
      if (input.investmentDurationMonths !== undefined)
        updateData.investmentDurationMonths = input.investmentDurationMonths;
      if (input.investmentRecoveryType !== undefined)
        updateData.investmentRecoveryType = input.investmentRecoveryType;
      if (input.investmentRecoveryValue !== undefined)
        updateData.investmentRecoveryValue = input.investmentRecoveryValue;
      if (input.investorProfitSharePercent !== undefined)
        updateData.investorProfitSharePercent =
          input.investorProfitSharePercent;
      if (input.investorProfitShareMode !== undefined)
        updateData.investorProfitShareMode = input.investorProfitShareMode;
      if (input.investorProfitShareBeforeBepPercent !== undefined)
        updateData.investorProfitShareBeforeBepPercent =
          input.investorProfitShareBeforeBepPercent;
      if (input.investorProfitShareAfterBepPercent !== undefined)
        updateData.investorProfitShareAfterBepPercent =
          input.investorProfitShareAfterBepPercent;
      if (input.contingencyPercent !== undefined)
        updateData.contingencyPercent = input.contingencyPercent;
      if (input.contingencyAmount !== undefined)
        updateData.contingencyAmount = input.contingencyAmount;
      if (input.nplTolerancePercent !== undefined)
        updateData.nplTolerancePercent = input.nplTolerancePercent;
      if (input.opexBufferFundingMode !== undefined)
        updateData.opexBufferFundingMode = input.opexBufferFundingMode;
      if (input.opexBufferInvestorPercent !== undefined)
        updateData.opexBufferInvestorPercent = input.opexBufferInvestorPercent;
      if (input.opexBufferCompanyPercent !== undefined)
        updateData.opexBufferCompanyPercent = input.opexBufferCompanyPercent;
      if (input.opexBufferInvestorFixedAmount !== undefined)
        updateData.opexBufferInvestorFixedAmount =
          input.opexBufferInvestorFixedAmount;
      if (input.opexBufferSafetyPercent !== undefined)
        updateData.opexBufferSafetyPercent = input.opexBufferSafetyPercent;
      if (input.hasDisbursementPlan !== undefined)
        updateData.hasDisbursementPlan = input.hasDisbursementPlan;

      await tx.rabProject.update({
        where: { id },
        data: updateData,
      });

      if (input.items !== undefined) {
        await tx.rabItem.deleteMany({ where: { rabProjectId: id } });
        await tx.rabWbs.deleteMany({ where: { rabProjectId: id } });

        const wbsMap = new Map<string, string>();
        if (input.wbsGroups && input.wbsGroups.length > 0) {
          for (const wbs of input.wbsGroups) {
            const createdWbs = await tx.rabWbs.create({
              data: {
                rabProjectId: id,
                name: wbs.name,
                order: wbs.order,
              },
            });
            if (wbs.id) {
              wbsMap.set(wbs.id, createdWbs.id);
            }
          }
        }

        if (input.items.length > 0) {
          for (const item of input.items) {
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

            const createdItem = await tx.rabItem.create({
              data: {
                rabProjectId: id,
                name: item.name,
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                category: item.category,
                expenseType: item.expenseType,
                expenseCategoryId: item.expenseCategoryId,
                totalPrice: BigInt(item.quantity) * item.unitPrice,
                wbsId: item.wbsGroupId
                  ? wbsMap.get(item.wbsGroupId)
                  : undefined,
              },
            });

            if (item.disbursements && item.disbursements.length > 0) {
              const disbursementData: Prisma.RabDisbursementCreateManyInput[] =
                [];

              for (const disbursement of item.disbursements) {
                if (
                  disbursement.name === undefined ||
                  disbursement.percentage === undefined ||
                  disbursement.amount === undefined
                ) {
                  continue;
                }

                disbursementData.push({
                  rabItemId: createdItem.id,
                  name: disbursement.name,
                  percentage: disbursement.percentage,
                  amount: disbursement.amount,
                  estimatedDate: disbursement.estimatedDate,
                  isPaid: disbursement.isPaid ?? false,
                });
              }

              if (disbursementData.length === 0) {
                continue;
              }

              await tx.rabDisbursement.createMany({
                data: disbursementData,
              });
            }
          }
        }
      }

      if (input.investorIds !== undefined) {
        await tx.rabInvestor.deleteMany({ where: { rabProjectId: id } });

        if (input.investorIds.length > 0) {
          const existingProject = await tx.rabProject.findUnique({
            where: { id },
            include: { items: true },
          });
          const investmentItems = input.items || existingProject?.items || [];
          const currentProfitShare =
            input.investorProfitSharePercent ??
            existingProject?.investorProfitSharePercent ??
            50;
          const investmentBase = existingProject
            ? getInvestorFundingBase(existingProject, investmentItems)
            : getCapexTotal(investmentItems);
          const amounts = splitInvestmentBase(
            investmentBase,
            input.investorIds,
          );

          await tx.rabInvestor.createMany({
            data: input.investorIds.map((investorId, index) => ({
              rabProjectId: id,
              investorId,
              investmentAmount: amounts[index],
              profitSharePercent: currentProfitShare,
            })),
          });
        }
      } else if (hasInvestorFundingBaseChange(input)) {
        const existingInvestors = await tx.rabInvestor.findMany({
          where: { rabProjectId: id },
        });

        if (existingInvestors.length > 0) {
          const existingProject = await tx.rabProject.findUnique({
            where: { id },
            include: { items: true },
          });
          const investmentItems = input.items || existingProject?.items || [];
          const currentProfitShare =
            input.investorProfitSharePercent ??
            existingProject?.investorProfitSharePercent ??
            50;
          const investmentBase = existingProject
            ? getInvestorFundingBase(existingProject, investmentItems)
            : getCapexTotal(investmentItems);
          const investorIds = existingInvestors.map(
            (investor) => investor.investorId,
          );
          const amounts = splitInvestmentBase(investmentBase, investorIds);

          for (const [index, investorId] of investorIds.entries()) {
            await tx.rabInvestor.updateMany({
              where: { rabProjectId: id, investorId },
              data: {
                investmentAmount: amounts[index],
                profitSharePercent: currentProfitShare,
              },
            });
          }
        }
      }

      return tx.rabProject.findUnique({
        where: { id },
        include: {
          items: { include: { disbursements: true } },
          wbsGroups: true,
        },
      });
    });
  }

  async createFullProject(data: {
    project: {
      name: string;
      description?: string;
      siteId?: string | null;
      mixRadiusGroupId?: string | null;
      mixRadiusInvestorSiteId?: string | null;
      projectedRevenue: bigint;
      projectedOpex: bigint;
      targetBasis?: RabTargetBasis;
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
      investorProfitShareMode?: RabInvestorProfitShareMode;
      investorProfitShareBeforeBepPercent?: number;
      investorProfitShareAfterBepPercent?: number;
      contingencyPercent: number;
      contingencyAmount: bigint;
      nplTolerancePercent: number;
      opexBufferFundingMode: RabOpexBufferFundingMode;
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
      category: RabItemCategory;
      expenseType: RabExpenseType;
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
  }): Promise<RabProjectWithDetails | null> {
    return this.client.$transaction(async (tx) => {
      const p = await tx.rabProject.create({
        data: {
          name: data.project.name,
          description: data.project.description,
          siteId: data.project.siteId,
          mixRadiusGroupId: data.project.mixRadiusGroupId,
          mixRadiusInvestorSiteId: data.project.mixRadiusInvestorSiteId,
          projectedRevenue: data.project.projectedRevenue,
          projectedOpex: data.project.projectedOpex,
          targetBasis: data.project.targetBasis,
          targetHomepass: data.project.targetHomepass,
          targetTakeUpRatePercent: data.project.targetTakeUpRatePercent,
          targetSubscribers: data.project.targetSubscribers,
          arpu: data.project.arpu,
          growthType: data.project.growthType as RabGrowthType,
          paymentType: data.project.paymentType as RabPaymentType,
          growthSettings: (data.project.growthSettings ||
            undefined) as Prisma.InputJsonValue,
          startDate: data.project.startDate,
          investmentDurationMonths: data.project.investmentDurationMonths,
          investmentRecoveryType: data.project
            .investmentRecoveryType as RabRecoveryType,
          investmentRecoveryValue: data.project.investmentRecoveryValue,
          investorProfitSharePercent: data.project.investorProfitSharePercent,
          investorProfitShareMode: data.project.investorProfitShareMode,
          investorProfitShareBeforeBepPercent:
            data.project.investorProfitShareBeforeBepPercent,
          investorProfitShareAfterBepPercent:
            data.project.investorProfitShareAfterBepPercent,
          contingencyPercent: data.project.contingencyPercent,
          contingencyAmount: data.project.contingencyAmount,
          nplTolerancePercent: data.project.nplTolerancePercent,
          opexBufferFundingMode: data.project.opexBufferFundingMode,
          opexBufferInvestorPercent: data.project.opexBufferInvestorPercent,
          opexBufferCompanyPercent: data.project.opexBufferCompanyPercent,
          opexBufferInvestorFixedAmount:
            data.project.opexBufferInvestorFixedAmount,
          opexBufferSafetyPercent: data.project.opexBufferSafetyPercent,
          hasDisbursementPlan: data.project.hasDisbursementPlan,
          createdBy: data.project.createdBy,
        },
      });

      const wbsMap = new Map<string, string>();
      for (const wbs of data.wbsGroups) {
        const createdWbs = await tx.rabWbs.create({
          data: {
            rabProjectId: p.id,
            name: wbs.name,
            order: wbs.order,
          },
        });
        if (wbs.id) {
          wbsMap.set(wbs.id, createdWbs.id);
        }
      }

      if (data.items.length > 0) {
        for (const item of data.items) {
          const createdItem = await tx.rabItem.create({
            data: {
              rabProjectId: p.id,
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              category: item.category,
              expenseType: item.expenseType,
              expenseCategoryId: item.expenseCategoryId,
              totalPrice: BigInt(item.quantity) * item.unitPrice,
              wbsId: item.wbsGroupId ? wbsMap.get(item.wbsGroupId) : undefined,
            },
          });

          if (item.disbursements && item.disbursements.length > 0) {
            const disbData = item.disbursements.map((d) => ({
              rabItemId: createdItem.id,
              name: d.name,
              percentage: d.percentage,
              amount: d.amount,
              estimatedDate: d.estimatedDate,
              isPaid: d.isPaid,
            }));
            await tx.rabDisbursement.createMany({ data: disbData });
          }
        }
      }

      if (data.investorIds && data.investorIds.length > 0) {
        const investmentBase = getInvestorFundingBase(data.project, data.items);
        const amounts = splitInvestmentBase(investmentBase, data.investorIds);

        await tx.rabInvestor.createMany({
          data: data.investorIds.map((id: string, index: number) => ({
            rabProjectId: p.id,
            investorId: id,
            investmentAmount: amounts[index],
            profitSharePercent: p.investorProfitSharePercent,
          })),
        });
      }

      return tx.rabProject.findUnique({
        where: { id: p.id },
        include: {
          items: { include: { disbursements: true } },
          wbsGroups: true,
        },
      });
    }) as Promise<RabProjectWithDetails | null>;
  }
}
