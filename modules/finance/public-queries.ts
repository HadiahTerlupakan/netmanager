/**
 * Entry publik SEMPIT module finance untuk module proyek yang perlu membaca
 * realisasi pengeluaran sebuah proyek RAB.
 *
 * Sengaja terpisah dari `index.ts`: index finance memuat banyak service, dan
 * `modules/proyek` hanya butuh satu query baca. Pintu ini menjaga arah
 * ketergantungan tetap satu arah dan bebas siklus.
 */
import { ExpenseRepository } from "./repositories/ExpenseRepository";

const expenseQueries = new ExpenseRepository();

export type ProjectExpenseRow = Awaited<
  ReturnType<ExpenseRepository["findProjectExpenses"]>
>[number];

/** Realisasi pengeluaran yang tertaut ke satu proyek RAB. */
export function getExpensesByRabProject(
  projectId: string,
): Promise<ProjectExpenseRow[]> {
  return expenseQueries.findProjectExpenses(projectId);
}
