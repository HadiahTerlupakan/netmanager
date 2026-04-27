import { RabExpenseType } from "@prisma/client";

import { buildRabBottleneckMetrics } from "../utils/rab-bottleneck-metrics";
import {
  buildRabRevisionVarianceSummary,
  getVarianceLabel,
} from "../utils/rab-revision-variance";
import { RabProjectRepository } from "../repositories/RabProjectRepository";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { createRouteServiceError } from "./RouteServiceError";

const DEFAULT_CONTINGENCY = "0";
const EMPTY_ITEM_ID = "";
type ActualAchievementInput = {
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
};

type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
};

type ProjectApprovalSummary = {
  status: string;
  createdAt: Date;
};

export class RabProjectRouteService {
  constructor(
    private readonly rabProjectRepository = new RabProjectRepository(),
    private readonly expenseRepository = new ExpenseRepository(),
  ) {}

  /** Get a serialized RAB project detail. */
  async getProjectDetail(id: string) {
    const project = await this.rabProjectRepository.findDetailById(id);

    if (!project) {
      throw createRouteServiceError("Proyek RAB", 404);
    }

    return this.serializeProjectDetail(project);
  }

  /** Delete a draft RAB project safely. */
  async deleteDraftProject(id: string) {
    const project = await this.rabProjectRepository.findById(id);

    if (!project) {
      throw createRouteServiceError("Proyek RAB", 404);
    }

    if (project.status !== "DRAFT") {
      throw createRouteServiceError(
        "Hanya proyek RAB dengan status DRAFT yang dapat dihapus",
        400,
      );
    }

    await this.rabProjectRepository.deleteDraftProject(id);
  }

  /** Duplicate a RAB project into a new draft. */
  async duplicateProject(id: string, userId: string) {
    const project = await this.rabProjectRepository.duplicateProject(
      id,
      userId,
    );

    if (!project) {
      throw createRouteServiceError("RAB Proyek tidak ditemukan", 404);
    }

    return this.serializeDuplicatedProject(project);
  }

  /** Upsert actual achievement for a RAB project. */
  async upsertActualAchievement(input: ActualAchievementInput) {
    const project = await this.rabProjectRepository.findById(
      input.rabProjectId,
    );

    if (!project) {
      throw createRouteServiceError("RAB Project", 404);
    }

    const achievement =
      await this.rabProjectRepository.upsertActualAchievement(input);
    return this.serializeAchievement(achievement);
  }

  /** Build RAB bottleneck dashboard metrics. */
  async getDashboardMetrics() {
    const projects = await this.rabProjectRepository.findManyWithDetails({
      OR: [{ status: "PENDING_APPROVAL" }, { status: "APPROVED" }],
    });

    const pendingProjects = projects
      .filter((project) => project.status === "PENDING_APPROVAL")
      .map(this.pickProjectSummary);
    const approvedApprovals = projects
      .filter((project) => project.status === "APPROVED")
      .flatMap((project) =>
        ((project.approvals ?? []) as ProjectApprovalSummary[])
          .filter((approval) => approval.status === "APPROVED")
          .map((approval) => ({
            rabProjectId: project.id,
            createdAt: approval.createdAt,
            rabProject: this.pickProjectSummary(project),
          })),
      )
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(0, 200);

    const projectsMap = new Map<string, ProjectSummary>();
    pendingProjects.forEach((project) => projectsMap.set(project.id, project));
    approvedApprovals.forEach((approval) => {
      projectsMap.set(approval.rabProject.id, approval.rabProject);
    });

    return buildRabBottleneckMetrics({
      now: new Date(),
      projects: Array.from(projectsMap.values()),
      approvals: approvedApprovals.map((approval) => ({
        rabProjectId: approval.rabProjectId,
        createdAt: approval.createdAt,
      })),
    });
  }

  /** Build revision profit-loss comparison for a RAB project. */
  async getRevisionProfitLoss(id: string) {
    const project =
      await this.rabProjectRepository.findRevisionProfitLossProject(id);

    if (!project) {
      throw createRouteServiceError("Proyek RAB", 404);
    }

    const expenses = await this.expenseRepository.findProjectExpenses(
      project.id,
    );
    const originalCapex = project.items.reduce((sum, item) => {
      if (item.expenseType === RabExpenseType.OPEX) {
        return sum;
      }

      return sum + item.totalPrice;
    }, 0n);
    const originalOpex = project.projectedOpex;
    const finalRevision = project.finalApprovedRevision;
    const finalCapex = finalRevision?.totalCapex ?? originalCapex;
    const finalOpex = finalRevision?.totalOpex ?? originalOpex;
    let actualCapex = 0n;
    let actualOpex = 0n;
    let unmappedRealization = 0n;

    for (const expense of expenses) {
      const expenseType = expense.rabItem?.expenseType ?? expense.category;

      if (
        expenseType === RabExpenseType.OPEX ||
        expense.category === RabExpenseType.OPEX
      ) {
        actualOpex += expense.amount;
      } else {
        actualCapex += expense.amount;
      }

      if (!expense.rabItemId) {
        unmappedRealization += expense.amount;
      }
    }

    const varianceSummary = buildRabRevisionVarianceSummary({
      originalCapex,
      originalOpex,
      finalCapex,
      finalOpex,
      actualCapex,
      actualOpex,
    });
    const itemActualTotals = new Map<string, bigint>();

    for (const expense of expenses) {
      if (!expense.rabItemId) {
        continue;
      }

      itemActualTotals.set(
        expense.rabItemId,
        (itemActualTotals.get(expense.rabItemId) ?? 0n) + expense.amount,
      );
    }

    return {
      originalSummary: {
        capex: originalCapex.toString(),
        opex: originalOpex.toString(),
        total: varianceSummary.originalTotal.toString(),
      },
      finalRevisionSummary: finalRevision
        ? {
            id: finalRevision.id,
            capex: finalCapex.toString(),
            opex: finalOpex.toString(),
            total: varianceSummary.finalTotal.toString(),
          }
        : null,
      actualSummary: {
        capex: actualCapex.toString(),
        opex: actualOpex.toString(),
        total: varianceSummary.actualTotal.toString(),
      },
      varianceSummary: {
        capexVariance: varianceSummary.capexVariance.toString(),
        opexVariance: varianceSummary.opexVariance.toString(),
        netVariance: varianceSummary.netVariance.toString(),
        capexLabel: varianceSummary.capexLabel,
        opexLabel: varianceSummary.opexLabel,
        netLabel: varianceSummary.netLabel,
      },
      itemVariances: (finalRevision?.items ?? []).map((item) => {
        const actualTotal =
          itemActualTotals.get(item.rabItemId ?? EMPTY_ITEM_ID) ?? 0n;
        const variance = item.totalPrice - actualTotal;

        return {
          rabItemId: item.rabItemId,
          revisionItemId: item.id,
          name: item.name,
          finalTotal: item.totalPrice.toString(),
          actualTotal: actualTotal.toString(),
          variance: variance.toString(),
          varianceLabel: getVarianceLabel(variance),
        };
      }),
      unmappedRealization: unmappedRealization.toString(),
    };
  }

  private pickProjectSummary(project: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
  }) {
    return {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
    };
  }

  private serializeProjectDetail(
    project: {
      projectedRevenue: bigint;
      projectedOpex: bigint;
      arpu: bigint | null;
      contingencyAmount: bigint | null;
      opexBufferInvestorFixedAmount: bigint | null;
      revisions?: unknown[];
      _count?: { revisions: number };
      items: Array<{
        unitPrice: bigint;
        totalPrice: bigint;
        disbursements?: Array<{ amount: bigint }>;
      }>;
      actualAchievements?: Array<{
        actualRevenue: bigint;
        actualOpex: bigint;
        manualRecoveryInstallment: bigint | null;
        manualInvestorShare: bigint | null;
        manualCompanyShare: bigint | null;
      }>;
    } & Record<string, unknown>,
  ) {
    const { revisions, _count, ...projectData } = project;

    return {
      ...projectData,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      contingencyAmount:
        project.contingencyAmount?.toString() || DEFAULT_CONTINGENCY,
      opexBufferInvestorFixedAmount:
        project.opexBufferInvestorFixedAmount?.toString() ||
        DEFAULT_CONTINGENCY,
      revisionCount: _count?.revisions || 0,
      latestRevision: revisions?.[0] || null,
      items: project.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
        disbursements: (item.disbursements || []).map((disbursement) => ({
          ...disbursement,
          amount: disbursement.amount.toString(),
        })),
      })),
      actualAchievements: (project.actualAchievements || []).map(
        (achievement) => ({
          ...achievement,
          actualRevenue: achievement.actualRevenue.toString(),
          actualOpex: achievement.actualOpex.toString(),
          manualRecoveryInstallment:
            achievement.manualRecoveryInstallment?.toString() || null,
          manualInvestorShare:
            achievement.manualInvestorShare?.toString() || null,
          manualCompanyShare:
            achievement.manualCompanyShare?.toString() || null,
        }),
      ),
    };
  }

  private serializeDuplicatedProject(
    project: {
      projectedRevenue: bigint;
      projectedOpex: bigint;
      arpu: bigint | null;
      items: Array<{ unitPrice: bigint; totalPrice: bigint }>;
    } & Record<string, unknown>,
  ) {
    return {
      ...project,
      projectedRevenue: project.projectedRevenue.toString(),
      projectedOpex: project.projectedOpex.toString(),
      arpu: project.arpu?.toString() || null,
      items: project.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toString(),
        totalPrice: item.totalPrice.toString(),
      })),
    };
  }

  private serializeAchievement(
    achievement: {
      actualRevenue: bigint;
      actualOpex: bigint;
      manualRecoveryInstallment: bigint | null;
      manualInvestorShare: bigint | null;
      manualCompanyShare: bigint | null;
      manualInvestorProfitSharePercent: number | null;
    } & Record<string, unknown>,
  ) {
    return {
      ...achievement,
      actualRevenue: achievement.actualRevenue.toString(),
      actualOpex: achievement.actualOpex.toString(),
      manualRecoveryInstallment:
        achievement.manualRecoveryInstallment?.toString() || null,
      manualInvestorShare: achievement.manualInvestorShare?.toString() || null,
      manualCompanyShare: achievement.manualCompanyShare?.toString() || null,
      manualInvestorProfitSharePercent:
        achievement.manualInvestorProfitSharePercent,
    };
  }
}
