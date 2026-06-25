import {
  addOvertimeAutoCheckoutJob,
  removeOvertimeAutoCheckoutJob,
} from "@/lib/event-bus/queues";

import type { IOvertimeRepository } from "../domain/ports/IOvertimeRepository";
import { OvertimeRepository } from "../repositories/OvertimeRepository";

const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;

export class OvertimeAutoCheckoutSchedulerService {
  private repository: IOvertimeRepository;

  constructor(repository: IOvertimeRepository = new OvertimeRepository()) {
    this.repository = repository;
  }

  /** Schedule delayed auto checkout job for an overtime session. */
  async schedule(input: { overtimeId: string; startTime: Date }) {
    const existing = await this.repository.findAutoCheckoutScheduleByOvertimeId(
      input.overtimeId,
    );

    await this.removeExistingJob(existing?.jobId);
    const scheduledFor = this.createScheduledFor(input.startTime);
    const schedule = await this.repository.upsertAutoCheckoutSchedule({
      overtimeId: input.overtimeId,
      scheduledFor,
      jobId: null,
    });
    const jobId = this.createJobId(schedule.id, schedule.version);

    await this.enqueueJob(
      input.overtimeId,
      schedule.id,
      schedule.version,
      scheduledFor,
      jobId,
    );
    await this.repository.attachAutoCheckoutJobId(input.overtimeId, jobId);

    return { ...schedule, jobId, scheduledFor };
  }

  /** Cancel delayed auto checkout job for an overtime session. */
  async cancel(overtimeId: string) {
    const schedule =
      await this.repository.findAutoCheckoutScheduleByOvertimeId(overtimeId);

    await this.removeExistingJob(schedule?.jobId);
    await this.repository.cancelAutoCheckoutSchedule({
      overtimeId,
      cancelledAt: new Date(),
    });
  }

  /** Remove previous queue job when it exists. */
  private async removeExistingJob(jobId?: string | null): Promise<void> {
    if (!jobId) {
      return;
    }

    await removeOvertimeAutoCheckoutJob(jobId);
  }

  /** Build delayed execution time. */
  private createScheduledFor(startTime: Date): Date {
    return new Date(startTime.getTime() + MAX_OVERTIME_DURATION_MS);
  }

  /** Build deterministic queue job id. */
  private createJobId(scheduleId: string, version: number): string {
    return `overtime.auto-checkout.${scheduleId}.v${version}`;
  }

  /** Push delayed job into queue. */
  private async enqueueJob(
    overtimeId: string,
    scheduleId: string,
    version: number,
    scheduledFor: Date,
    jobId: string,
  ): Promise<void> {
    const delay = Math.max(scheduledFor.getTime() - Date.now(), 0);

    await addOvertimeAutoCheckoutJob(
      { overtimeId, scheduleId, version },
      { jobId, delay },
    );
  }
}
