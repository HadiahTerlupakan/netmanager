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
import type { IRabProjectRepository } from "../domain/ports/IRabProjectRepository";
import { RabProjectUpdateRepository } from "./RabProjectUpdateRepository";
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
export class RabProjectRepository implements IRabProjectRepository {
  private updateRepository: RabProjectUpdateRepository;
  constructor(private client: PrismaClient = prisma) {
    this.updateRepository = new RabProjectUpdateRepository(this.client);
  }
  /** Get active projects that need status evaluation. */
  async findProjectsForStatusEvaluation(): Promise<
    RabProjectStatusCandidate[]
  > {
    return this.client.rabProject.findMany({
      where: {
        status: {
          in: ["PENJUALAN", "TARGET_TERCAPAI"],
        },
      },
      include: {
        actualAchievements: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }) as Promise<RabProjectStatusCandidate[]>;
  }
  /**
   * Update a single RAB project status.
   */
  async updateProjectStatus(id: string, status: RabStatus): Promise<boolean> {
    try {
      await this.client.rabProject.update({
        where: { id },
        data: {
          status,
          updatedAt: new Date(),
        },
      });
      return true;
    } catch {
      return false;
    }
  }
  /** Get many RAB projects with nested detail relations. */
  async findManyWithDetails(
    where: Prisma.RabProjectWhereInput,
  ): Promise<RabProjectWithDetails[]> {
    return this.client.rabProject.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      include: {
        items: {
          orderBy: [{ wbsId: "asc" }, { id: "asc" }],
          include: {
            disbursements: {
              orderBy: [{ estimatedDate: "asc" }, { id: "asc" }],
            },
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
          select: { id: true, revisionNumber: true, status: true },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        _count: { select: { revisions: true } },
      },
    }) as Promise<RabProjectWithDetails[]>;
  }
  /** Create a basic RAB project. */
  async createProject(data: Prisma.RabProjectCreateInput): Promise<RabProject> {
    return this.client.rabProject.create({ data });
  }
  /** Find a RAB project with items and WBS groups. */
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
  /** Find a detailed RAB project for route responses. */
  async findDetailById(id: string) {
    return this.client.rabProject.findUnique({
      where: { id },
      include: {
        items: {
          include: { disbursements: true },
        },
        wbsGroups: true,
        actualAchievements: {
          orderBy: [{ year: "asc" }, { month: "asc" }],
        },
        site: { select: { name: true } },
        creator: { select: { name: true } },
        investors: true,
        revisions: {
          select: {
            id: true,
            revisionNumber: true,
            status: true,
          },
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        _count: {
          select: {
            revisions: true,
          },
        },
      },
    });
  }
  /** Find a RAB project for revision profit-loss analysis. */
  async findRevisionProfitLossProject(id: string) {
    return this.client.rabProject.findUnique({
      where: { id },
      include: {
        items: true,
        finalApprovedRevision: {
          include: {
            items: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
  }
  /** Find a lightweight RAB project by id. */
  async findById(id: string) {
    return this.client.rabProject.findUnique({
      where: { id },
    });
  }
  /** Delete a draft RAB project and detach dependent expenses. */
  async deleteDraftProject(id: string) {
    return this.client.$transaction([
      this.client.rabInvestor.deleteMany({
        where: { rabProjectId: id },
      }),
      this.client.expense.updateMany({
        where: { rabProjectId: id },
        data: { rabProjectId: null },
      }),
      this.client.rabProject.delete({
        where: { id },
      }),
    ]);
  }
  /** Duplicate a RAB project with all items as a new draft. */
  async duplicateProject(id: string, userId: string) {
    const sourceProject = await this.client.rabProject.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sourceProject) {
      return null;
    }
    return this.client.rabProject.create({
      data: {
        name: `(Copy) ${sourceProject.name}`,
        description: sourceProject.description,
        siteId: sourceProject.siteId,
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
        status: "DRAFT",
        createdBy: userId,
        items: {
          create: sourceProject.items.map((item) => ({
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            category: item.category,
            expenseType: item.expenseType,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }
  /** Upsert actual achievement for a RAB project period. */
  async upsertActualAchievement(input: {
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
    return this.client.rabActualAchievement.upsert({
      where: {
        rabProjectId_month_year: {
          rabProjectId: input.rabProjectId,
          month: input.month,
          year: input.year,
        },
      },
      create: input,
      update: {
        actualSubscribers: input.actualSubscribers,
        actualRevenue: input.actualRevenue,
        actualOpex: input.actualOpex,
        manualRecoveryInstallment: input.manualRecoveryInstallment,
        manualInvestorShare: input.manualInvestorShare,
        manualCompanyShare: input.manualCompanyShare,
        manualInvestorProfitSharePercent:
          input.manualInvestorProfitSharePercent,
        notes: input.notes,
      },
    });
  }
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
    return this.updateRepository.updateProjectWithRelations(id, input);
  }
  /** Create a complete RAB project with nested items and investors. */
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
