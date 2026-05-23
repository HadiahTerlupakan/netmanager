import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { getPphService } from "../../index";

const SOURCE = "SalaryProcessedTaxHandler";

/**
 * Handles SALARY_PROCESSED event to record PPh 21 tax transaction.
 * Only creates a TaxTransaction record — journal posting is handled
 * by the accounting module's salary-processed handler to prevent double-debit.
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

  const grossSalaryNum = Number(grossSalary);
  const pph21AmountNum = Number(pph21Amount);

  if (isNaN(grossSalaryNum) || isNaN(pph21AmountNum)) {
    logger.warn(
      `[${SOURCE}] Invalid numeric payload for entry ${salaryId}: grossSalary="${grossSalary}", pph21Amount="${pph21Amount}", skipping`,
    );
    return;
  }

  if (pph21AmountNum === 0) {
    logger.info(
      `[${SOURCE}] PPh 21 amount is 0 for entry ${salaryId}, skipping`,
    );
    return;
  }

  const pphService = getPphService();
  await pphService.recordPph21({
    tenantId,
    salaryId,
    grossSalary: grossSalaryNum,
    pph21Amount: pph21AmountNum,
    processedDate: new Date(processedAt),
  });
}
