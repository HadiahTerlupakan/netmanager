import { prisma } from '@/lib/prisma'
import { type Transaction, type Prisma } from '@prisma/client'
import type { ITransactionRepository } from './ITransactionRepository'


export class TransactionRepository implements ITransactionRepository {
  async findAll(params?: {
    startDate?: Date
    endDate?: Date
    categoryId?: string
    accountId?: string
    siteId?: string
  }): Promise<Transaction[]> {
    const where: Prisma.TransactionWhereInput = {}
    
    if (params?.startDate && params?.endDate) {
      where.date = {
        gte: params.startDate,
        lte: params.endDate
      }
    }

    if (params?.categoryId) {
      where.categoryId = params.categoryId
    }

    if (params?.accountId) {
      where.accountId = params.accountId
    }

    if (params?.siteId) {
        where.OR = [
            { createdBy: { siteId: params.siteId } },
            { purchaseOrder: { creator: { siteId: params.siteId } } }
        ]
    }

    return prisma.transaction.findMany({
      where,
      include: {
        category: true,
        createdBy: {
            select: { name: true }
        },
        purchaseOrder: {
            select: { poNumber: true }
        }
      },
      orderBy: { date: 'desc' }
    })
  }

  async create(data: Prisma.TransactionCreateInput): Promise<Transaction> {
    return prisma.transaction.create({
      data
    })
  }

  async findByPurchaseOrder(poId: string): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      where: { purchaseOrderId: poId }
    })
  }
}
