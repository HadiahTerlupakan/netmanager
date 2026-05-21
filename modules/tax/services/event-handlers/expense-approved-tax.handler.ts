import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import { getPphService, getPpnService } from "../../index";

const SOURCE = "ExpenseApprovedTaxHandler";

/** PPh category classification based on expense category type/name */
type PphClassification = "jasa" | "sewa_tanah" | "sewa" | null;

/**
 * Determines PPh classification from expense category.
 * - type "sewa_tanah" or name containing "sewa tanah"/"sewa bangunan" → PPh 4(2)
 * - type "sewa" or name containing "sewa" → PPh 23 (sewa)
 * - type "jasa" or name containing "jasa" → PPh 23 (jasa)
 * - otherwise → no PPh
 */
function classifyPph(
  categoryType: string,
  categoryName: string,
): PphClassification {
  const typeLower = categoryType.toLowerCase();
  const nameLower = categoryName.toLowerCase();

  if (
    typeLower === "sewa_tanah" ||
    nameLower.includes("sewa tanah") ||
    nameLower.includes("sewa bangunan")
  ) {
    return "sewa_tanah";
  }

  if (typeLower === "sewa" || nameLower.includes("sewa")) {
    return "sewa";
  }

  if (typeLower === "jasa" || nameLower.includes("jasa")) {
    return "jasa";
  }

  return null;
}

/**
 * Handles EXPENSE_APPROVED event to record PPh and PPN Masukan.
 * - PPh 23 for jasa/sewa expenses
 * - PPh 4(2) for sewa tanah/bangunan expenses
 * - PPN Masukan if tenant is PKP
 * Gracefully skips if COA not seeded or category not applicable.
 */
export async function handleExpenseApprovedTax(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const expenseId = requirePayloadString(
    payload.expenseId,
    "expenseId",
    SOURCE,
  );
  const tenantId = requirePayloadString(payload.tenantId, "tenantId", SOURCE);
  const amount = requirePayloadString(payload.amount, "amount", SOURCE);
  const expenseCategoryId = requirePayloadString(
    payload.expenseCategoryId,
    "expenseCategoryId",
    SOURCE,
  );
  const expenseDate = requirePayloadString(
    payload.expenseDate,
    "expenseDate",
    SOURCE,
  );

  const expenseAmount = Number(amount);
  const entryDate = new Date(expenseDate);

  try {
    // 1. Lookup expense category to determine PPh type
    const category = await prisma.expenseCategory.findUnique({
      where: { id: expenseCategoryId },
      select: { type: true, name: true },
    });

    if (!category) {
      logger.warn(
        `[${SOURCE}] ExpenseCategory ${expenseCategoryId} not found, skipping PPh`,
      );
      return;
    }

    // 2. Record PPh based on classification
    const classification = classifyPph(category.type, category.name);
    const pphService = getPphService();

    if (classification === "sewa_tanah") {
      await pphService.recordPph4({
        tenantId,
        expenseId,
        amount: expenseAmount,
        expenseDate: entryDate,
      });
    } else if (classification === "sewa") {
      await pphService.recordPph23({
        tenantId,
        expenseId,
        amount: expenseAmount,
        category: "sewa",
        expenseDate: entryDate,
      });
    } else if (classification === "jasa") {
      await pphService.recordPph23({
        tenantId,
        expenseId,
        amount: expenseAmount,
        category: "jasa",
        expenseDate: entryDate,
      });
    }

    // 3. Record PPN Masukan if tenant is PKP
    const ppnService = getPpnService();
    await ppnService.recordPpnMasukan({
      tenantId,
      expenseId,
      expenseAmount,
      expenseDate: entryDate,
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
