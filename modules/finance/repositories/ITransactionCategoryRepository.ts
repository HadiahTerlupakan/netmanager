import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
import { type TransactionCategory, type Prisma } from '@/prisma/generated/billing'

export interface ITransactionCategoryRepository {
  findAll(): Promise<TransactionCategory[]>
  findById(id: string): Promise<TransactionCategory | null>
  create(data: PrismaBilling.TransactionCategoryCreateInput): Promise<TransactionCategory>
  update(id: string, data: PrismaBilling.TransactionCategoryUpdateInput): Promise<TransactionCategory>
  delete(id: string): Promise<TransactionCategory>
}
