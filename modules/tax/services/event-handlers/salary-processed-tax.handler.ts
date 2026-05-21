import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import { getPphService } from "../../index";

const SOURCE = "SalaryProcessedTaxHandler";

/**
 * Handles SALARY_PROCESSED event to record PPh 21.
 * The PPh 21 amount is pre-calculated by the salary module.
 * Gracefully skips if COA not seeded or pph21Amount is 0.
 */
export async function handleSalaryProcessedTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const salaryId = requirePayloadString(payload.salaryId, "salaryId", SOURCE);
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const grossSalary = requirePayloadString(
    payload.grossSalary,
    "grossSalary",
    SOURCE,
  );
  const pph21Amount = requirePayloadString(
    payload.pph21Amount,
    "pph21Amount",
    SOURCE,
  );
  const processedAt = requirePayloadString(
    payload.processedAt,
    "processedAt",
    SOURCE,
  );

  try {
    const pphService = getPphService();
    await pphService.recordPph21({
      tenantId,
      salaryId,
      grossSalary: Number(grossSalary),
      pph21Amount: Number(pph21Amount),
      processedDate: new Date(processedAt),
    });
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(
        `[${SOURCE}] COA belum di-seed untuk tenant ${tenantId}, skipping: ${error.message}`,
      );
      return;
    }
    throw error;
  }
}
