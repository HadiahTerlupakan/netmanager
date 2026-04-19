import {
  addOvertimeAutoCheckoutJob,
  removeOvertimeAutoCheckoutJob,
} from "@/lib/event-bus/queues";

import { OvertimeRepository } from "../repositories/OvertimeRepository";

const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;

export class OvertimeAutoCheckoutSchedulerService {
  private repository = new OvertimeRepository();

  async schedule(input: { overtimeId: string; startTime: Date }) {
    const existing = await this.repository.findAutoCheckoutScheduleByOvertimeId(
      input.overtimeId,
    );

    if (existing?.jobId) {
      await removeOvertimeAutoCheckoutJob(existing.jobId);
    }

    const scheduledFor = new Date(
      input.startTime.getTime() + MAX_OVERTIME_DURATION_MS,
    );

    const schedule = await this.repository.upsertAutoCheckoutSchedule({
      overtimeId: input.overtimeId,
      scheduledFor,
      jobId: null,
    });

    const jobId = `overtime:auto-checkout:${schedule.id}:v${schedule.version}`;
    const delay = Math.max(scheduledFor.getTime() - Date.now(), 0);

    await addOvertimeAutoCheckoutJob(
      {
        overtimeId: input.overtimeId,
        scheduleId: schedule.id,
        version: schedule.version,
      },
      { jobId, delay },
    );

    await this.repository.attachAutoCheckoutJobId(input.overtimeId, jobId);

    return { ...schedule, jobId, scheduledFor };
  }

  async cancel(overtimeId: string) {
    const schedule =
      await this.repository.findAutoCheckoutScheduleByOvertimeId(overtimeId);

    if (schedule?.jobId) {
      await removeOvertimeAutoCheckoutJob(schedule.jobId);
    }

    await this.repository.cancelAutoCheckoutSchedule({
      overtimeId,
      cancelledAt: new Date(),
    });
  }
}
