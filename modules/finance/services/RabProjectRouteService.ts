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
import {
  buildItemActualTotals,
  getItemActualTotal,
  serializeAchievement,
  serializeDuplicatedProject,
  serializeProjectDetail,
  serializeUpdatedProject,
} from "./rabProjectRouteSerializers";
import {
  assertDraftRabProjectStatus,
  assertMutableRabProjectStatus,
  assertRabProjectExists,
  buildApprovedProjectApprovals,
  buildUniqueMetricProjects,
  calculateActualRabTotals,
  calculateOriginalRabCapex,
  pickRabProjectSummary,
} from "./rab-project-route.helpers";

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

export class RabProjectRouteService {
  constructor(
    private readonly rabProjectRepository = new RabProjectRepository(),
    private readonly expenseRepository = new ExpenseRepository(),
  ) {}

  /** Get a serialized RAB project detail. */
  async getProjectDetail(id: string) {
    const project = assertRabProjectExists(
      await this.rabProjectRepository.findDetailById(id),
      "Proyek RAB",
    );

    return serializeProjectDetail(project);
  }

  /** Update a RAB project and return route-ready serialized data. */
  async updateProject(id: string, input: RabProjectUpdateInput) {
    assertMutableRabProjectStatus(input.status);

    const project = assertRabProjectExists(
      await this.rabProjectRepository.updateProjectWithRelations(id, input),
      "Proyek RAB",
    );

    return serializeUpdatedProject(project);
  }

  /** Delete a draft RAB project safely. */
  async deleteDraftProject(id: string) {
    const project = assertRabProjectExists(
      await this.rabProjectRepository.findById(id),
      "Proyek RAB",
    );

    assertDraftRabProjectStatus(project.status);
    await this.rabProjectRepository.deleteDraftProject(id);
  }

  /** Duplicate a RAB project into a new draft. */
  async duplicateProject(id: string, userId: string) {
    const project = assertRabProjectExists(
      await this.rabProjectRepository.duplicateProject(id, userId),
      "RAB Proyek tidak ditemukan",
    );

    return serializeDuplicatedProject(project);
  }

  /** Upsert actual achievement for a RAB project. */
  async upsertActualAchievement(input: ActualAchievementInput) {
    assertRabProjectExists(
      await this.rabProjectRepository.findById(input.rabProjectId),
      "RAB Project",
    );

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
      .map(pickRabProjectSummary);
    const approvedApprovals = buildApprovedProjectApprovals(projects);

    return buildRabBottleneckMetrics({
      now: new Date(),
      projects: buildUniqueMetricProjects(pendingProjects, approvedApprovals),
      approvals: approvedApprovals.map((approval) => ({
        rabProjectId: approval.rabProjectId,
        createdAt: approval.createdAt,
      })),
    });
  }

  /** Build revision profit-loss comparison for a RAB project. */
  async getRevisionProfitLoss(id: string) {
    const project = assertRabProjectExists(
      await this.rabProjectRepository.findRevisionProfitLossProject(id),
      "Proyek RAB",
    );

    const expenses = await this.expenseRepository.findProjectExpenses(
      project.id,
    );
    const originalCapex = calculateOriginalRabCapex(project.items);
    const originalOpex = project.projectedOpex;
    const finalRevision = project.finalApprovedRevision;
    const finalCapex = finalRevision?.totalCapex ?? originalCapex;
    const finalOpex = finalRevision?.totalOpex ?? originalOpex;
    const actualTotals = calculateActualRabTotals(expenses);
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
}
