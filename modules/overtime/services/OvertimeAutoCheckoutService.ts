import type { OvertimeAutoCheckoutJobData } from "@/lib/event-bus/queues";

import type { IOvertimeRepository } from "../domain/ports/IOvertimeRepository";
import { OvertimeRepository } from "../repositories/OvertimeRepository";

export const MAX_OVERTIME_DURATION_MINUTES = 8 * 60;

export class OvertimeAutoCheckoutService {
  /** Execute one delayed auto checkout job. */
  static async runScheduledAutoCheckout(
    job: OvertimeAutoCheckoutJobData,
    repository: IOvertimeRepository = new OvertimeRepository(),
  ): Promise<"completed" | "skipped"> {
    const schedule = await repository.findAutoCheckoutScheduleById(
      job.scheduleId,
    );
    if (!this.isRunnableSchedule(schedule, job)) {
      return "skipped";
    }

    const now = new Date();
    if (schedule.scheduledFor.getTime() > now.getTime()) {
      return "skipped";
    }

    const overtime = await repository.findById(job.overtimeId);
    if (overtime?.status !== "IN_PROGRESS") {
      await repository.completeAutoCheckoutSchedule({
        overtimeId: job.overtimeId,
        executedAt: now,
        scheduleStatus: "FAILED",
        lastError: "OVERTIME_AUTO_CHECKOUT_STALE",
      });
      return "skipped";
    }

    const isCompleted = await repository.completeScheduledAutoCheckout({
      scheduleId: schedule.id,
      overtimeId: job.overtimeId,
      version: job.version,
      executedAt: now,
      endTime: schedule.scheduledFor,
      duration: MAX_OVERTIME_DURATION_MINUTES,
    });

    return isCompleted ? "completed" : "skipped";
  }

  /** Check whether schedule still matches the current job. */
  private static isRunnableSchedule(
    schedule: Awaited<
      ReturnType<IOvertimeRepository["findAutoCheckoutScheduleById"]>
    >,
    job: OvertimeAutoCheckoutJobData,
  ): schedule is NonNullable<
    Awaited<ReturnType<IOvertimeRepository["findAutoCheckoutScheduleById"]>>
  > {
    if (!schedule || schedule.scheduleStatus !== "SCHEDULED") {
      return false;
    }

    return (
      schedule.overtimeId === job.overtimeId && schedule.version === job.version
    );
  }
}
