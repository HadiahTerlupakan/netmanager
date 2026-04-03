import { prisma } from '@/lib/prisma'
import type { PrismaClient, ExpenseCategory } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export interface ExpenseCategoryWithStats extends ExpenseCategory {
  parent?: { name: string } | null
  _count?: { children: number }
  totalDirect: number
}

export class ExpenseCategoryRepository {
  constructor(private client: PrismaClient = prisma) {}

  async findManyWithStats(where: { type?: string }, expenseWhere: { date?: { gte: Date; lte: Date } }): Promise<ExpenseCategoryWithStats[]> {
    const categories = await this.client.expenseCategory.findMany({
      where,
      include: {
        parent: { select: { name: true } },
        _count: { select: { children: true } },
        expenses: { where: expenseWhere, select: { amount: true } }
      },
      orderBy: { name: 'asc' }
    })

    return categories.map(cat => {
      const { expenses, ...rest } = cat
      return {
        ...rest,
        totalDirect: expenses.reduce((sum, e) => sum + Number(e.amount), 0)
      }
    })
  }

  async findFirstDuplicate(name: string, type: string, parentId: string | null): Promise<ExpenseCategory | null> {
    return this.client.expenseCategory.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        type,
        parentId: parentId || null
      }
    })
  }

  async createCategory(data: { name: string; type: string; parentId?: string }): Promise<ExpenseCategory> {
    return this.client.expenseCategory.create({
      data: {
        name: data.name,
        type: data.type,
        ...(data.parentId ? { parentId: data.parentId } : {})
      }
    })
  }

  async findFirst(where: Prisma.ExpenseCategoryWhereInput): Promise<ExpenseCategory | null> {
    return this.client.expenseCategory.findFirst({ where })
  }
}
