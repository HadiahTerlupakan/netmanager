import { type Transaction, Prisma } from '@prisma/client'

export interface ITransactionRepository {
  findAll(params?: {
    startDate?: Date
    endDate?: Date
    categoryId?: string
    accountId?: string
    siteId?: string
  }): Promise<Transaction[]>
  
  create(data: Prisma.TransactionCreateInput): Promise<Transaction>
  findByPurchaseOrder(poId: string): Promise<Transaction[]>
}
