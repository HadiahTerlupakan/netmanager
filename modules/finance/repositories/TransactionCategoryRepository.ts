import { Prisma as PrismaBilling } from '@/prisma/generated/billing';
import { prisma } from '@/lib/prisma'
import { prismaBilling } from '@/lib/prisma-billing';
import { type TransactionCategory, type Prisma } from '@/prisma/generated/billing'
import type { ITransactionCategoryRepository } from './ITransactionCategoryRepository'


export class TransactionCategoryRepository implements ITransactionCategoryRepository {
  async findAll(): Promise<TransactionCategory[]> {
    return prismaBilling.transactionCategory.findMany({
      orderBy: { name: 'asc' }
    })
  }

  async findById(id: string): Promise<TransactionCategory | null> {
    return prismaBilling.transactionCategory.findUnique({
      where: { id }
    })
  }

  async create(data: PrismaBilling.TransactionCategoryCreateInput): Promise<TransactionCategory> {
    return prismaBilling.transactionCategory.create({
      data
    })
  }

  async update(id: string, data: PrismaBilling.TransactionCategoryUpdateInput): Promise<TransactionCategory> {
    return prismaBilling.transactionCategory.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<TransactionCategory> {
    return prismaBilling.transactionCategory.delete({
      where: { id }
    })
  }
}
