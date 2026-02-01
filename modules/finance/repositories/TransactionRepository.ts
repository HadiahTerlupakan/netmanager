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

  async getExpenseSummary(startDate: Date, endDate: Date): Promise<{ CAPITAL: number; OPERATIONAL: number; OTHER: number }> {
    // Group by categoryId and sum amount
    const grouped = await prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        type: 'EXPENSE',
        date: {
          gte: startDate,
          lte: endDate
        },
        categoryId: {
            not: undefined // Ensure categoryId is present
        }
      },
      _sum: {
        amount: true
      }
    })

    // Fetch category details to map to ExpenseType
    // This is necessary because groupBy doesn't support relations
    const categoryIds = grouped.map(g => g.categoryId).filter(id => id !== null) as string[]

    const categories = await prisma.transactionCategory.findMany({
      where: {
        id: { in: categoryIds }
      },
      select: {
        id: true,
        expenseType: true
      }
    })

    const categoryMap = new Map(categories.map(c => [c.id, c.expenseType]))

    const summary = {
      CAPITAL: 0,
      OPERATIONAL: 0,
      OTHER: 0
    }

    for (const group of grouped) {
      if (!group.categoryId) continue

      const expenseType = categoryMap.get(group.categoryId) || 'OTHER'
      const amount = group._sum.amount || 0

      if (expenseType === 'CAPITAL') {
        summary.CAPITAL += amount
      } else if (expenseType === 'OPERATIONAL') {
        summary.OPERATIONAL += amount
      } else {
        summary.OTHER += amount
      }
    }

    return summary
  }
}
