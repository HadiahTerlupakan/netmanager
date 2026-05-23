import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { CoaNotFoundError } from "@/modules/accounting";
import { getPphService, getPpnService } from "../../index";
import { classifyPph } from "../PphClassifier";

const SOURCE = "ExpenseApprovedTaxHandler";

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
    const classification = classifyPph({
      categoryType: category.type,
      categoryName: category.name,
    });
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
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
      select: {
        fakturPajakNo: true,
        fakturPajakDate: true,
        vendorNpwp: true,
      },
    });

    const ppnService = getPpnService();
    await ppnService.recordPpnMasukan({
      tenantId,
      expenseId,
      expenseAmount,
      expenseDate: entryDate,
      fakturPajakNo: expense?.fakturPajakNo ?? null,
      fakturPajakDate: expense?.fakturPajakDate ?? null,
      counterpartNpwp: expense?.vendorNpwp ?? null,
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
