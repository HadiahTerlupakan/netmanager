import {
  addBillingScheduleJob,
  removeBillingScheduleJob,
} from "@/lib/event-bus";
import { logger } from "@/lib/logger";
import type {
  BillingScheduleEntity,
  BillingScheduleJobType,
} from "../domain/entities/BillingScheduleEntity";
import type { IBillingScheduleRepository } from "../domain/ports/IBillingScheduleRepository";
import { BillingScheduleRepository } from "../repositories/BillingScheduleRepository";

function createBillingScheduleRepository(): IBillingScheduleRepository {
  return new BillingScheduleRepository();
}

/** Service orchestration untuk enqueue dan eksekusi billing schedule durable. */
export class BillingScheduleService {
  constructor(
    private readonly repository: IBillingScheduleRepository = createBillingScheduleRepository(),
  ) {}

  async schedule(input: {
    dedupeKey: string;
    jobType: BillingScheduleJobType;
    invoiceId?: string | null;
    pelangganId?: string | null;
    runAt: Date;
    payload?: Record<string, unknown> | null;
    tenantId?: string | null;
  }) {
    const existing = await this.repository.findByDedupeKey(input.dedupeKey);
    await this.removeExistingJob(existing);

    const schedule = await this.repository.upsert(input);
    const { jobId } = await this.enqueuePersistedSchedule(schedule);

    logger.info(
      `[BillingSchedule] Scheduled ${schedule.jobType} for ${schedule.runAt.toISOString()} (${schedule.id})`,
    );

    return { ...schedule, queueJobId: jobId };
  }

  async enqueuePersistedSchedule(
    schedule: BillingScheduleEntity,
    now: Date = new Date(),
  ): Promise<{ jobId: string; delay: number }> {
    await this.removeExistingJob(schedule);

    const jobId = this.createJobId(schedule.id, schedule.version);
    const delay = Math.max(schedule.runAt.getTime() - now.getTime(), 0);

    await addBillingScheduleJob(
      { scheduleId: schedule.id, version: schedule.version },
      { jobId, delay },
    );
    await this.repository.attachQueueJobId(schedule.id, jobId);
    await this.repository.markQueued(schedule.id, now);

    logger.info(
      `[BillingSchedule] Enqueued ${schedule.jobType} for ${schedule.runAt.toISOString()} (${schedule.id})`,
    );

    return { jobId, delay };
  }

  async cancel(dedupeKey: string) {
    const existing = await this.repository.findByDedupeKey(dedupeKey);
    await this.removeExistingJob(existing);
    return this.repository.cancel({ dedupeKey, cancelledAt: new Date() });
  }

  async executeScheduledJob(
    scheduleId: string,
    options?: { version?: number },
  ): Promise<void> {
    const schedule = await this.repository.findById(scheduleId);
    if (!schedule) {
      logger.warn(`[BillingSchedule] Schedule ${scheduleId} not found`);
      return;
    }

    if (options?.version && options.version !== schedule.version) {
      logger.info(
        `[BillingSchedule] Skip stale job ${scheduleId} version ${options.version}; active version ${schedule.version}`,
      );
      return;
    }

    if (schedule.status === "COMPLETED" || schedule.status === "CANCELLED") {
      return;
    }

    await this.repository.markProcessing(schedule.id, new Date());

    try {
      await this.executeByJobType(schedule);

      await this.repository.markCompleted({
        scheduleId: schedule.id,
        completedAt: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.repository.markFailed({
        scheduleId: schedule.id,
        failedAt: new Date(),
        lastError: message,
      });
      throw error;
    }
  }

  private async executeByJobType(
    schedule: BillingScheduleEntity,
  ): Promise<void> {
    switch (schedule.jobType) {
      case "INVOICE_MARK_OVERDUE": {
        if (!schedule.invoiceId) {
          throw new Error("Billing schedule overdue kehilangan invoiceId");
        }
        const { InvoiceOverdueExecutionService } =
          await import("./InvoiceOverdueExecutionService");
        await new InvoiceOverdueExecutionService().execute(schedule.invoiceId);
        return;
      }
      case "CUSTOMER_AUTO_ISOLIR": {
        if (!schedule.invoiceId || !schedule.pelangganId) {
          throw new Error(
            "Billing schedule auto isolir kehilangan invoiceId atau pelangganId",
          );
        }
        // Ambil invoiceNumber dan tenantId untuk payload event (audit trail)
        const { prismaBilling } = await import("@/lib/prisma-billing");
        const invoiceData = await prismaBilling.invoice.findUnique({
          where: { id: schedule.invoiceId },
          select: { invoiceNumber: true, tenantId: true },
        });
        if (!invoiceData) {
          throw new Error(
            `Billing schedule auto isolir: invoice ${schedule.invoiceId} tidak ditemukan`,
          );
        }
        const { BillingEventDispatcher } = await import("@/modules/events");
        await BillingEventDispatcher.onAutoIsolateRequested({
          invoiceId: schedule.invoiceId,
          pelangganId: schedule.pelangganId,
          invoiceNumber: invoiceData.invoiceNumber,
          tenantId: invoiceData.tenantId ?? undefined,
        });
        return;
      }
      default:
        throw new Error(
          `Unsupported billing schedule job type: ${schedule.jobType}`,
        );
    }
  }

  private createJobId(scheduleId: string, version: number): string {
    return `billing-schedule.${scheduleId}.v${version}`;
  }

  private async removeExistingJob(
    schedule: BillingScheduleEntity | null,
  ): Promise<void> {
    if (!schedule) {
      return;
    }

    const jobIds = new Set<string>();
    if (schedule.queueJobId) {
      jobIds.add(schedule.queueJobId);
    }
    jobIds.add(this.createJobId(schedule.id, schedule.version));

    for (const jobId of jobIds) {
      await removeBillingScheduleJob(jobId);
    }
  }
}

export async function rehydrateBillingScheduleJobs(): Promise<void> {
  const repository = createBillingScheduleRepository();
  const service = new BillingScheduleService(repository);
  const schedules = await repository.findForRehydration(new Date());

  for (const schedule of schedules) {
    await service.enqueuePersistedSchedule(schedule);
  }
}
