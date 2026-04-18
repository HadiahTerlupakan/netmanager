import { OvertimeStatus } from "@prisma/client";

import { OvertimeRepository } from "../repositories/OvertimeRepository";

const MAX_OVERTIME_DURATION_MINUTES = 8 * 60;
const MAX_OVERTIME_DURATION_MS = MAX_OVERTIME_DURATION_MINUTES * 60 * 1000;

export class OvertimeAutoCheckoutService {
  static async runAutoCheckout() {
    const overtimeRepository = new OvertimeRepository();
    const activeOvertimes = await overtimeRepository.findAll({
      status: OvertimeStatus.IN_PROGRESS,
    });
    const now = new Date();
    let updatedCount = 0;

    for (const overtime of activeOvertimes) {
      if (!overtime.startTime) {
        continue;
      }

      const startTime = new Date(overtime.startTime);
      const autoCheckoutTime = new Date(
        startTime.getTime() + MAX_OVERTIME_DURATION_MS,
      );

      if (now.getTime() < autoCheckoutTime.getTime()) {
        continue;
      }

      await overtimeRepository.update(overtime.id, {
        status: OvertimeStatus.COMPLETED,
        endTime: autoCheckoutTime,
        duration: MAX_OVERTIME_DURATION_MINUTES,
      });
      updatedCount++;
    }

    return updatedCount;
  }
}

export { MAX_OVERTIME_DURATION_MINUTES };
