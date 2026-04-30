import type { RabStatus } from "../types/invoice.enums";
import {
  RabProjectRepository,
  type RabProjectStatusCandidate,
} from "../repositories/RabProjectRepository";

const STATUS_PENJUALAN = "PENJUALAN" as RabStatus;
const STATUS_TARGET_TERCAPAI = "TARGET_TERCAPAI" as RabStatus;
const STATUS_SELESAI = "SELESAI" as RabStatus;

export interface RabStatusEvaluationResult {
  updatedToTargetTercapai: number;
  updatedToSelesai: number;
  updatedProjectIds: string[];
  checkedDate: string;
}

function getContractEndStatus(params: {
  project: RabProjectStatusCandidate;
  now: Date;
}): RabStatus | null {
  const { project, now } = params;
  if (!project.startDate || !project.investmentDurationMonths) {
    return null;
  }

  const endDate = new Date(project.startDate);
  endDate.setMonth(endDate.getMonth() + project.investmentDurationMonths);

  return now >= endDate ? STATUS_SELESAI : null;
}

function getTargetReachedStatus(
  project: RabProjectStatusCandidate,
  currentStatus: RabStatus,
): RabStatus | null {
  if (currentStatus !== STATUS_PENJUALAN || !project.targetSubscribers) {
    return null;
  }

  const latestAchievement = project.actualAchievements?.[0];
  if (!latestAchievement) {
    return null;
  }

  return latestAchievement.actualSubscribers >= project.targetSubscribers
    ? STATUS_TARGET_TERCAPAI
    : null;
}

function resolveNextStatus(params: {
  project: RabProjectStatusCandidate;
  now: Date;
}): RabStatus {
  const { project, now } = params;

  return (
    getContractEndStatus({ project, now }) ??
    getTargetReachedStatus(project, project.status) ??
    project.status
  );
}

export class RabStatusEvaluationService {
  private rabProjectRepository = new RabProjectRepository();

  /**
   * Evaluate and update RAB project statuses automatically.
   */
  async evaluateStatuses(): Promise<RabStatusEvaluationResult> {
    const now = new Date();
    const activeProjects =
      await this.rabProjectRepository.findProjectsForStatusEvaluation();
    const result: RabStatusEvaluationResult = {
      updatedToTargetTercapai: 0,
      updatedToSelesai: 0,
      updatedProjectIds: [],
      checkedDate: now.toISOString().split("T")[0],
    };

    for (const project of activeProjects) {
      const nextStatus = resolveNextStatus({ project, now });
      if (nextStatus === project.status) {
        continue;
      }

      const updated = await this.rabProjectRepository.updateProjectStatus(
        project.id,
        nextStatus,
      );
      if (!updated) {
        continue;
      }

      if (nextStatus === STATUS_TARGET_TERCAPAI) {
        result.updatedToTargetTercapai += 1;
      }

      if (nextStatus === STATUS_SELESAI) {
        result.updatedToSelesai += 1;
      }

      result.updatedProjectIds.push(project.id);
    }

    return result;
  }
}

let rabStatusEvaluationServiceInstance: RabStatusEvaluationService | null =
  null;

/**
 * Get singleton RAB status evaluation service instance.
 */
export function getRabStatusEvaluationService(): RabStatusEvaluationService {
  if (!rabStatusEvaluationServiceInstance) {
    rabStatusEvaluationServiceInstance = new RabStatusEvaluationService();
  }

  return rabStatusEvaluationServiceInstance;
}
