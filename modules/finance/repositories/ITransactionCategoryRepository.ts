import { type TransactionCategory, type Prisma } from '@prisma/client'

export interface ITransactionCategoryRepository {
  findAll(): Promise<TransactionCategory[]>
  findById(id: string): Promise<TransactionCategory | null>
  create(data: Prisma.TransactionCategoryCreateInput): Promise<TransactionCategory>
  update(id: string, data: Prisma.TransactionCategoryUpdateInput): Promise<TransactionCategory>
  delete(id: string): Promise<TransactionCategory>
}
