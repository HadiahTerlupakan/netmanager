import { prisma } from '@/lib/prisma'
import { type TransactionCategory, type Prisma } from '@prisma/client'
import type { ITransactionCategoryRepository } from './ITransactionCategoryRepository'


export class TransactionCategoryRepository implements ITransactionCategoryRepository {
  async findAll(): Promise<TransactionCategory[]> {
    return prisma.transactionCategory.findMany({
      orderBy: { name: 'asc' }
    })
  }

  async findById(id: string): Promise<TransactionCategory | null> {
    return prisma.transactionCategory.findUnique({
      where: { id }
    })
  }

  async create(data: Prisma.TransactionCategoryCreateInput): Promise<TransactionCategory> {
    return prisma.transactionCategory.create({
      data
    })
  }

  async update(id: string, data: Prisma.TransactionCategoryUpdateInput): Promise<TransactionCategory> {
    return prisma.transactionCategory.update({
      where: { id },
      data
    })
  }

  async delete(id: string): Promise<TransactionCategory> {
    return prisma.transactionCategory.delete({
      where: { id }
    })
  }
}
