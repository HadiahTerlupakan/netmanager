import { ExpenseCategoryRepository } from '../repositories/ExpenseCategoryRepository'
import { ExpenseRepository } from '../repositories/ExpenseRepository'

export class FinanceExpenseBridgeService {
  private expenseCategoryRepo = new ExpenseCategoryRepository()
  private expenseRepo = new ExpenseRepository()

  findDepreciationCategory(tenantId: string) {
    return this.expenseCategoryRepo.findFirst({
      tenantId,
      OR: [
        { name: { contains: 'penyusutan', mode: 'insensitive' } },
        { name: { contains: 'depreciation', mode: 'insensitive' } },
      ],
    })
  }

  createDepreciationExpense(input: {
    amount: bigint
    date: Date
    expenseCategoryId: string
    category: string
    description: string
    userId: string
  }) {
    return this.expenseRepo.createDepreciationExpense(input)
  }
}
