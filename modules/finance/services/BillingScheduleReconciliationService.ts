import { logger } from "@/lib/logger";
import type { BillingScheduleEntity } from "../domain/entities/BillingScheduleEntity";
import type { IBillingScheduleRepository } from "../domain/ports/IBillingScheduleRepository";
import { BillingScheduleRepository } from "../repositories/BillingScheduleRepository";
import { BillingScheduleService } from "./BillingScheduleService";

function createBillingScheduleRepository(): IBillingScheduleRepository {
  return new BillingScheduleRepository();
}

export interface BillingScheduleReconciliationResult {
  scanned: number;
  requeued: number;
  pendingRequeued: number;
  queuedRequeued: number;
  failedRetried: number;
  staleProcessingRecovered: number;
  errors: number;
}

/** Menyamakan schedule billing durable dengan queue runtime setelah missed execution atau restart. */
export class BillingScheduleReconciliationService {
  constructor(
    private readonly repository: IBillingScheduleRepository = createBillingScheduleRepository(),
    private readonly billingScheduleService: BillingScheduleService = new BillingScheduleService(
      repository,
    ),
  ) {}

  async reconcile(options?: {
    now?: Date;
    staleProcessingMinutes?: number;
  }): Promise<BillingScheduleReconciliationResult> {
    const now = options?.now ?? new Date();
    const staleProcessingMinutes = options?.staleProcessingMinutes ?? 15;
    const staleProcessingBefore = new Date(
      now.getTime() - staleProcessingMinutes * 60 * 1000,
    );

    const schedules = await this.repository.findForReconciliation(
      now,
      staleProcessingBefore,
    );
    const result = this.createEmptyResult(schedules.length);

    for (const schedule of schedules) {
      try {
        const scheduleToEnqueue = await this.prepareScheduleForRetry(schedule);
        await this.billingScheduleService.enqueuePersistedSchedule(
          scheduleToEnqueue,
          now,
        );
        this.recordSuccess(result, schedule.status);
      } catch (error) {
        result.errors += 1;
        logger.error(
          `[BillingScheduleReconciliation] Gagal memproses schedule ${schedule.id}`,
          error,
        );
      }
    }

    logger.info(
      `[BillingScheduleReconciliation] scanned=${result.scanned} requeued=${result.requeued} pending=${result.pendingRequeued} queued=${result.queuedRequeued} failed=${result.failedRetried} staleProcessing=${result.staleProcessingRecovered} errors=${result.errors}`,
    );

    return result;
  }

  private async prepareScheduleForRetry(
    schedule: BillingScheduleEntity,
  ): Promise<BillingScheduleEntity> {
    if (schedule.status !== "PROCESSING") {
      return schedule;
    }

    return this.repository.updateStatus(schedule.id, "PENDING");
  }

  private recordSuccess(
    result: BillingScheduleReconciliationResult,
    status: BillingScheduleEntity["status"],
  ): void {
    result.requeued += 1;

    switch (status) {
      case "PENDING":
        result.pendingRequeued += 1;
        return;
      case "QUEUED":
        result.queuedRequeued += 1;
        return;
      case "FAILED":
        result.failedRetried += 1;
        return;
      case "PROCESSING":
        result.staleProcessingRecovered += 1;
        return;
      default:
        return;
    }
  }

  private createEmptyResult(
    scanned: number,
  ): BillingScheduleReconciliationResult {
    return {
      scanned,
      requeued: 0,
      pendingRequeued: 0,
      queuedRequeued: 0,
      failedRetried: 0,
      staleProcessingRecovered: 0,
      errors: 0,
    };
  }
}
