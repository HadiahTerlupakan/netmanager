import {
  Prisma,
  RabExpenseType,
  RabGrowthType,
  RabInvestorProfitShareMode,
  RabItemCategory,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
} from "@prisma/client";
import { RabProjectRepository } from "../repositories";

type RabProjectRepo = Pick<
  RabProjectRepository,
  "findManyWithDetails" | "createFullProject"
>;

type RabProjectPayload = {
  name: string;
  description?: string;
  siteId?: string | null;
  mixRadiusGroupId?: string | null;
  mixRadiusInvestorSiteId?: string | null;
  projectedRevenue: bigint;
  projectedOpex: bigint;
  targetBasis: RabTargetBasis;
  targetHomepass?: number;
  targetTakeUpRatePercent: number;
  targetSubscribers?: number;
  arpu?: bigint;
  growthType: RabGrowthType;
  paymentType: RabPaymentType;
  growthSettings?: unknown;
  startDate?: Date;
  investmentDurationMonths: number;
  investmentRecoveryType: "PERCENTAGE" | "FIXED";
  investmentRecoveryValue: number;
  investorProfitSharePercent: number;
  investorProfitShareMode: RabInvestorProfitShareMode;
  investorProfitShareBeforeBepPercent: number;
  investorProfitShareAfterBepPercent: number;
  contingencyPercent: number;
  contingencyAmount: bigint;
  nplTolerancePercent: number;
  opexBufferFundingMode: RabOpexBufferFundingMode;
  opexBufferInvestorPercent: number;
  opexBufferCompanyPercent: number;
  opexBufferInvestorFixedAmount: bigint;
  opexBufferSafetyPercent: number;
  hasDisbursementPlan: boolean;
  wbsGroups: Array<{ id?: string; name: string; order: number }>;
  investorIds: string[];
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
      id?: string;
      name: string;
      percentage: number;
      amount: bigint;
      estimatedDate?: Date;
      isPaid: boolean;
    }>;
  }>;
};

export class FinanceRabFacadeService {
  constructor(
    private readonly rabProjectRepo: RabProjectRepo = new RabProjectRepository(),
  ) {}

  /** Get RAB projects with nested data and serialization. */
  async getRabProjects(params: {
    siteId?: string | null;
    mixRadiusGroupId?: string | null;
    mixRadiusInvestorSiteId?: string | null;
    status?: string | null;
  }) {
    const projects = await this.rabProjectRepo.findManyWithDetails(
      this.buildProjectWhere(params),
    );

    return projects.map((project) => this.serializeProject(project));
  }

  /** Create a new RAB project with nested items, WBS, and investors. */
  async createRabProject(data: RabProjectPayload, userId: string) {
    const project = await this.rabProjectRepo.createFullProject({
      project: this.buildProjectPayload(data, userId),
      wbsGroups: data.wbsGroups,
      items: this.buildItemPayloads(data.items),
      investorIds: data.investorIds,
      investorProfitSharePercent: data.investorProfitSharePercent,
    });

    if (!project) throw new Error("Gagal membuat proyek RAB");
    return this.serializeCreatedProject(project);
  }

  private buildProjectWhere(params: {
    siteId?: string | null;
    mixRadiusGroupId?: string | null;
    mixRadiusInvestorSiteId?: string | null;
    status?: string | null;
  }): Prisma.RabProjectWhereInput {
    const where: Prisma.RabProjectWhereInput = {};
    if (params.siteId) where.siteId = params.siteId;
    if (params.mixRadiusGroupId)
      where.mixRadiusGroupId = params.mixRadiusGroupId;
    if (params.mixRadiusInvestorSiteId) {
      where.mixRadiusInvestorSiteId = params.mixRadiusInvestorSiteId;
    }
    if (params.status)
      where.status = params.status as Prisma.RabProjectWhereInput["status"];
    return where;
  }

  private buildProjectPayload(data: RabProjectPayload, userId: string) {
    return {
      name: data.name,
      description: data.description,
      siteId: data.siteId,
      mixRadiusGroupId: data.mixRadiusGroupId,
      mixRadiusInvestorSiteId: data.mixRadiusInvestorSiteId,
      projectedRevenue: data.projectedRevenue,
      projectedOpex: data.projectedOpex,
      targetBasis: data.targetBasis,
      targetHomepass: data.targetHomepass,
      targetTakeUpRatePercent: data.targetTakeUpRatePercent,
      targetSubscribers: data.targetSubscribers,
      arpu: data.arpu,
      growthType: data.growthType,
      paymentType: data.paymentType,
      growthSettings: (data.growthSettings ||
        undefined) as Prisma.InputJsonValue,
      startDate: data.startDate,
      investmentDurationMonths: data.investmentDurationMonths,
      investmentRecoveryType: data.investmentRecoveryType,
      investmentRecoveryValue: data.investmentRecoveryValue,
      investorProfitSharePercent: data.investorProfitSharePercent,
      investorProfitShareMode: data.investorProfitShareMode,
      investorProfitShareBeforeBepPercent:
        data.investorProfitShareBeforeBepPercent,
      investorProfitShareAfterBepPercent:
        data.investorProfitShareAfterBepPercent,
      contingencyPercent: data.contingencyPercent,
      contingencyAmount: data.contingencyAmount,
      nplTolerancePercent: data.nplTolerancePercent,
      opexBufferFundingMode: data.opexBufferFundingMode,
      opexBufferInvestorPercent: data.opexBufferInvestorPercent,
      opexBufferCompanyPercent: data.opexBufferCompanyPercent,
      opexBufferInvestorFixedAmount: data.opexBufferInvestorFixedAmount,
      opexBufferSafetyPercent: data.opexBufferSafetyPercent,
      hasDisbursementPlan: data.hasDisbursementPlan,
      createdBy: userId,
    };
  }

  private buildItemPayloads(items: RabProjectPayload["items"]) {
    return items.map((item) => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      category: item.category,
      expenseType: item.expenseType,
      expenseCategoryId: item.expenseCategoryId,
      wbsGroupId: item.wbsGroupId,
      disbursements: item.disbursements.map((disbursement) => ({
        name: disbursement.name,
        percentage: disbursement.percentage,
        amount: disbursement.amount,
        estimatedDate: disbursement.estimatedDate,
        isPaid: disbursement.isPaid,
      })),
    }));
  }

  private serializeProject(
    project: Awaited<ReturnType<RabProjectRepo["findManyWithDetails"]>>[number],
  ) {
    const { revisions, _count, ...projectData } = project;

    return {
      ...projectData,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      contingencyAmount: project.contingencyAmount?.toString() || "0",
      opexBufferInvestorFixedAmount:
        project.opexBufferInvestorFixedAmount?.toString() || "0",
      revisionCount: _count?.revisions || 0,
      latestRevision: revisions?.[0] || null,
      investors: (project.investors || []).map((investor) => ({
        ...investor,
        investmentAmount: investor.investmentAmount?.toString() || "0",
      })),
      items: this.serializeProjectItems(project.items),
    };
  }

  private serializeCreatedProject(
    project: NonNullable<
      Awaited<ReturnType<RabProjectRepo["createFullProject"]>>
    >,
  ) {
    return {
      ...project,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      items: this.serializeProjectItems(project.items || []),
      contingencyAmount: project.contingencyAmount?.toString(),
      opexBufferInvestorFixedAmount:
        project.opexBufferInvestorFixedAmount?.toString() || "0",
    };
  }

  private serializeProjectItems(
    items: Array<{
      unitPrice: bigint;
      totalPrice: bigint;
      disbursements?: Array<{ amount: bigint }>;
    }>,
  ) {
    return items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toString(),
      totalPrice: item.totalPrice.toString(),
      disbursements: (item.disbursements || []).map((disbursement) => ({
        ...disbursement,
        amount: disbursement.amount.toString(),
      })),
    }));
  }
}
