import { ExpenseRepository } from "../repositories/ExpenseRepository";

export class FinanceExpenseQueryService {
  constructor(private readonly repository = new ExpenseRepository()) {}

  /** Find profit-loss expenses in the selected date range. */
  findProfitLossExpenses(
    input: Parameters<ExpenseRepository["findProfitLossExpenses"]>[0],
  ) {
    return this.repository.findProfitLossExpenses(input);
  }

  /** Find yearly profit-loss expenses for aggregate charts. */
  findYearlyProfitLossExpenses(
    input: Parameters<ExpenseRepository["findYearlyProfitLossExpenses"]>[0],
  ) {
    return this.repository.findYearlyProfitLossExpenses(input);
  }
}
