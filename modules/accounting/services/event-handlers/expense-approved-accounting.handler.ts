import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { postExpenseJournal } from "../journal/expense-journals";
import { CoaNotFoundError } from "../../errors";

const SOURCE = "ExpenseApprovedAccountingHandler";

export async function handleExpenseApprovedAccounting(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const expenseId = requirePayloadString(
    payload.expenseId,
    "expenseId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);

  try {
    if (await postExpenseJournal(tenantId, expenseId)) {
      logger.info(`[${SOURCE}] Journal posted for expense ${expenseId}`);
    }
  } catch (error) {
    if (error instanceof CoaNotFoundError) {
      logger.warn(`[${SOURCE}] COA belum di-seed, skipping: ${error.message}`);
      return;
    }
    throw error;
  }
}
