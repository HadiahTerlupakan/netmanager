import { RabExpenseType } from "../types/invoice.enums";

import { buildRabBottleneckMetrics } from "../utils/rab-bottleneck-metrics";
import {
  buildRabRevisionVarianceSummary,
  getVarianceLabel,
} from "../utils/rab-revision-variance";
import {
  RabProjectRepository,
  type RabProjectUpdateInput,
} from "../repositories/RabProjectRepository";
import { ExpenseRepository } from "../repositories/ExpenseRepository";
import { createRouteServiceError } from "./RouteServiceError";
import {
  buildItemActualTotals,
  getItemActualTotal,
  serializeAchievement,
  serializeDuplicatedProject,
  serializeProjectDetail,
  serializeUpdatedProject,
} from "./rabProjectRouteSerializers";

const APPROVAL_ONLY_STATUSES = new Set(["APPROVED", "REJECTED"]);
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

    return serializeProjectDetail(project);
  }

  /** Update a RAB project and return route-ready serialized data. */
  async updateProject(id: string, input: RabProjectUpdateInput) {
    if (this.isApprovalOnlyStatus(input.status)) {
      throw createRouteServiceError(
        "Status approval RAB wajib diproses melalui endpoint approval.",
        400,
      );
    }

    const project = await this.rabProjectRepository.updateProjectWithRelations(
      id,
      input,
    );

    if (!project) {
      throw createRouteServiceError("Proyek RAB", 404);
    }

    return serializeUpdatedProject(project);
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

    return serializeDuplicatedProject(project);
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
    return serializeAchievement(achievement);
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
    const originalCapex = this.calculateOriginalCapex(project.items);
    const originalOpex = project.projectedOpex;
    const finalRevision = project.finalApprovedRevision;
    const finalCapex = finalRevision?.totalCapex ?? originalCapex;
    const finalOpex = finalRevision?.totalOpex ?? originalOpex;
    const actualTotals = this.calculateActualTotals(expenses);
    const varianceSummary = buildRabRevisionVarianceSummary({
      originalCapex,
      originalOpex,
      finalCapex,
      finalOpex,
      actualCapex: actualTotals.actualCapex,
      actualOpex: actualTotals.actualOpex,
    });
    const itemActualTotals = buildItemActualTotals(expenses);

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
        capex: actualTotals.actualCapex.toString(),
        opex: actualTotals.actualOpex.toString(),
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
        const actualTotal = getItemActualTotal(
          itemActualTotals,
          item.rabItemId,
        );
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
      unmappedRealization: actualTotals.unmappedRealization.toString(),
    };
  }

  /** Calculates original CAPEX from non-OPEX project items. */
  private calculateOriginalCapex(
    items: Array<{ expenseType: RabExpenseType; totalPrice: bigint }>,
  ) {
    return items.reduce((sum, item) => {
      if (item.expenseType === RabExpenseType.OPEX) {
        return sum;
      }

      return sum + item.totalPrice;
    }, 0n);
  }

  /** Calculates actual CAPEX, OPEX, and unmapped realization totals. */
  private calculateActualTotals(
    expenses: Array<{
      amount: bigint;
      category: string;
      rabItemId?: string | null;
      rabItem?: { expenseType?: RabExpenseType | null } | null;
    }>,
  ) {
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

    return { actualCapex, actualOpex, unmappedRealization };
  }

  /** Creates a compact project summary for dashboard metric aggregation. */
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

  /** Checks whether a status is reserved for approval endpoints only. */
  private isApprovalOnlyStatus(status: string | undefined) {
    return status !== undefined && APPROVAL_ONLY_STATUSES.has(status);
  }
}
