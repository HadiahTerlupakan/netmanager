import { OvertimeStatus } from "@prisma/client";

import type { OvertimeAutoCheckoutJobData } from "@/lib/event-bus/queues";

import { OvertimeRepository } from "../repositories/OvertimeRepository";

export const MAX_OVERTIME_DURATION_MINUTES = 8 * 60;

export class OvertimeAutoCheckoutService {
  static async runScheduledAutoCheckout(
    job: OvertimeAutoCheckoutJobData,
  ): Promise<"completed" | "skipped"> {
    const overtimeRepository = new OvertimeRepository();
    const schedule = await overtimeRepository.findAutoCheckoutScheduleById(
      job.scheduleId,
    );

    if (!schedule || schedule.scheduleStatus !== "SCHEDULED") {
      return "skipped";
    }

    if (
      schedule.overtimeId !== job.overtimeId ||
      schedule.version !== job.version
    ) {
      return "skipped";
    }

    const now = new Date();
    if (schedule.scheduledFor.getTime() > now.getTime()) {
      return "skipped";
    }

    const overtime = await overtimeRepository.findById(job.overtimeId);
    if (!overtime || overtime.status !== OvertimeStatus.IN_PROGRESS) {
      await overtimeRepository.completeAutoCheckoutSchedule({
        overtimeId: job.overtimeId,
        executedAt: now,
        scheduleStatus: "FAILED",
        lastError: "OVERTIME_AUTO_CHECKOUT_STALE",
      });
      return "skipped";
    }

    const didComplete = await overtimeRepository.completeScheduledAutoCheckout({
      scheduleId: schedule.id,
      overtimeId: job.overtimeId,
      version: job.version,
      executedAt: now,
      endTime: schedule.scheduledFor,
      duration: MAX_OVERTIME_DURATION_MINUTES,
    });

    return didComplete ? "completed" : "skipped";
  }
}
