import { logger } from "@/lib/logger";

import type { OvertimeEntity } from "../domain/entities/OvertimeEntity";
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";

/** Menangani interaksi aman dengan scheduler auto-checkout overtime. */
export class OvertimeServiceScheduler {
  constructor(
    private readonly autoCheckoutScheduler: OvertimeAutoCheckoutSchedulerService,
  ) {}

  /** Jadwalkan auto-checkout overtime tanpa melempar error ke flow utama. */
  async schedule(overtime: OvertimeEntity): Promise<void> {
    try {
      await this.autoCheckoutScheduler.schedule({
        overtimeId: overtime.id,
        startTime: overtime.startTime!,
      });
    } catch (error) {
      logSchedulerError("schedule", overtime.id, error);
    }
  }

  /** Batalkan auto-checkout overtime tanpa memutus flow utama. */
  async cancel(overtimeId: string): Promise<void> {
    try {
      await this.autoCheckoutScheduler.cancel(overtimeId);
    } catch (error) {
      logSchedulerError("cancel", overtimeId, error);
    }
  }
}

function logSchedulerError(
  action: "schedule" | "cancel",
  overtimeId: string,
  error: unknown,
): void {
  logger.error(
    `[Overtime] Failed to ${action} auto checkout for ${overtimeId}`,
    error,
  );
}
