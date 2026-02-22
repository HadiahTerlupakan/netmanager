import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
import { type Transaction, Prisma } from '@/prisma/generated/billing'

export interface ITransactionRepository {
  findAll(params?: {
    startDate?: Date
    endDate?: Date
    categoryId?: string
    accountId?: string
    siteId?: string
  }): Promise<Transaction[]>
  
  create(data: PrismaBilling.TransactionCreateInput): Promise<Transaction>
  findByPurchaseOrder(poId: string): Promise<Transaction[]>
  getExpenseSummary(startDate: Date, endDate: Date): Promise<{ CAPITAL: number; OPERATIONAL: number; OTHER: number }>
}
