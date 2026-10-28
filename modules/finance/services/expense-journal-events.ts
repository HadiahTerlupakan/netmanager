import { eventBus } from "@/lib/event-bus";
import { EVENT_NAMES } from "@/lib/event-bus/types";
import { logger } from "@/lib/logger";

/**
 * Pengeluaran yang dicatat dari menu Pengeluaran dibukukan lewat event
 * EXPENSE_APPROVED. Dulu hanya input batch yang mengirimnya, dan hanya bila
 * rekening diisi, sehingga pengeluaran lain tidak pernah sampai ke arus kas.
 */
export function publishExpenseRecorded(expense: {
  id: string;
  tenantId: string | null;
  amount: bigint;
  accountId: string | null;
  expenseCategoryId: string | null;
  date: Date;
}) {
  if (!expense.tenantId) return;
  eventBus
    .publish(EVENT_NAMES.EXPENSE_APPROVED, {
      expenseId: expense.id,
      tenantId: expense.tenantId,
      amount: expense.amount.toString(),
      ...(expense.accountId ? { accountId: expense.accountId } : {}),
      ...(expense.expenseCategoryId
        ? { expenseCategoryId: expense.expenseCategoryId }
        : {}),
      expenseDate: expense.date.toISOString(),
    })
    .catch((error) =>
      logger.error(
        `[Expense] Gagal mengirim EXPENSE_APPROVED untuk ${expense.id}:`,
        error,
      ),
    );
}

/**
 * Pengeluaran sudah tersimpan saat ini dipanggil; jurnal yang gagal
 * disamakan dilaporkan dan bisa dikoreksi manual dari menu Jurnal.
 */
export async function resyncExpenseBooks(input: {
  tenantId: string | null;
  expenseId: string;
  reason: string;
}) {
  if (!input.tenantId) return;
  try {
    // Dimuat saat dipakai agar finance tidak menarik seluruh modul akuntansi.
    const { resyncExpenseJournal } = await import("@/modules/accounting");
    await resyncExpenseJournal({
      tenantId: input.tenantId,
      expenseId: input.expenseId,
      reason: input.reason,
      actor: "Sistem",
    });
  } catch (error) {
    logger.error(
      `[Expense] Gagal menyamakan jurnal pengeluaran ${input.expenseId}:`,
      error,
    );
  }
}
