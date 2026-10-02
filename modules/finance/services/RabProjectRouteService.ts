import { createRouteServiceError } from "@/lib/api/route-service-error";
import {
  hasActiveInvestorProfitShare,
  isRabProjectMonthShared,
} from "@/modules/investor/public-queries";
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
import { ModalInvestorTerkunciError } from "../repositories/RabProjectUpdateRepository";
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

const HTTP_CONFLICT = 409;

function isTanggalSama(kiri: Date | null, kanan: Date | null): boolean {
  if (!kiri || !kanan) return kiri === kanan;
  return kiri.toISOString().slice(0, 10) === kanan.toISOString().slice(0, 10);
}

/** Tahun kalender bulan ke-n proyek; tanpa tanggal mulai pakai tahun dari klien/sekarang. */
function tahunBulanProyek(
  tanggalMulai: Date | null,
  bulanKe: number,
  tahunCadangan?: number,
): number {
  if (!tanggalMulai) return tahunCadangan ?? new Date().getFullYear();
  return new Date(
    Date.UTC(tanggalMulai.getUTCFullYear(), tanggalMulai.getUTCMonth() + bulanKe - 1, 1),
  ).getUTCFullYear();
}

type ActualAchievementInput = {
  rabProjectId: string;
  month: number;
  /** Dipakai hanya bila proyek belum punya tanggal mulai. */
  year?: number;
  actualSubscribers: number;
  actualRevenue: bigint;
  actualOpex: bigint | null;
  manualRecoveryInstallment: bigint | null;
  manualInvestorShare: bigint | null;
  manualCompanyShare: bigint | null;
  manualInvestorProfitSharePercent: number | null;
  notes?: string;
};

/** Status bagi hasil investor atas proyek RAB (data milik module investor). */
export interface RabInvestorProfitShareLookup {
  hasActiveProfitShare(rabProjectId: string): Promise<boolean>;
  isProjectMonthShared(rabProjectId: string, month: number): Promise<boolean>;
}

const investorProfitShareLookup: RabInvestorProfitShareLookup = {
  hasActiveProfitShare: hasActiveInvestorProfitShare,
  isProjectMonthShared: isRabProjectMonthShared,
};

export class RabProjectRouteService {
  constructor(
    private readonly rabProjectRepository = new RabProjectRepository(),
    private readonly expenseRepository = new ExpenseRepository(),
    private readonly profitShareLookup: RabInvestorProfitShareLookup = investorProfitShareLookup,
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

    // Proyek yang sudah punya bagi hasil investor: tanggal mulai (penentu bulan
    // ke-n), daftar investor, dan modalnya dikunci agar bulan yang sudah dibayar
    // tidak bergeser atau terhitung ulang.
    const kunciModalInvestor = await this.profitShareLookup.hasActiveProfitShare(id);
    if (kunciModalInvestor && input.startDate !== undefined) {
      const sekarang = await this.rabProjectRepository.findById(id);
      if (!isTanggalSama(sekarang?.startDate ?? null, input.startDate ?? null)) {
        throw createRouteServiceError(
          "Proyek ini sudah punya bagi hasil investor. Tanggal mulai tidak bisa diubah lagi.",
          HTTP_CONFLICT,
        );
      }
    }

    try {
      const project = assertRabProjectExists(
        await this.rabProjectRepository.updateProjectWithRelations(id, input, kunciModalInvestor),
        "Proyek RAB",
      );
      return serializeUpdatedProject(project);
    } catch (error) {
      if (error instanceof ModalInvestorTerkunciError) {
        throw createRouteServiceError(error.message, HTTP_CONFLICT);
      }
      throw error;
    }
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

  /**
   * Simpan capaian bulan ke-n proyek. Tahun dihitung dari tanggal mulai
   * proyek (bukan dari klien). Bulan yang sudah masuk bagi hasil investor
   * dikunci agar angka yang sudah dibayar tidak berubah.
   */
  async upsertActualAchievement(input: ActualAchievementInput) {
    const project = assertRabProjectExists(
      await this.rabProjectRepository.findById(input.rabProjectId),
      "RAB Project",
    );
    if (await this.profitShareLookup.isProjectMonthShared(input.rabProjectId, input.month)) {
      throw createRouteServiceError(
        `Bulan ke-${input.month} sudah masuk bagi hasil investor dan tidak bisa diubah lagi. Bila bagi hasilnya belum dibayar, batalkan dulu di Investor → Bagi Hasil.`,
        HTTP_CONFLICT,
      );
    }

    const achievement = await this.rabProjectRepository.upsertActualAchievement({
      ...input,
      year: tahunBulanProyek(project.startDate, input.month, input.year),
    });
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
